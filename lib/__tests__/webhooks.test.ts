import crypto from 'crypto';

// Ensure env vars exist for lazy init paths
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-test-key';

// Mock supabase-js createClient to control RPC behavior
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => {
      return {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        // rpc will be set per-test via mock implementation
        rpc: jest.fn(),
      } as any;
    }),
  };
});

// Import after mocks
import { signWebhook, dispatchPendingDeliveries } from '@/lib/webhooks';
import { createClient } from '@supabase/supabase-js';

const mockedCreateClient = createClient as unknown as jest.Mock;

// Shared mocked client to be returned by createClient
const mockClient: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
};

mockedCreateClient.mockReturnValue(mockClient);

function mockRpcImplementation(sequence: Array<(fn: string, args: any) => any>) {
  mockClient.rpc.mockImplementation((fn: string, args: any) => {
    const handler = sequence.shift();
    if (!handler) {
      throw new Error(`Unexpected RPC call ${fn}`);
    }
    return handler(fn, args);
  });
  return mockClient.rpc;
}

describe('webhooks.signWebhook', () => {
  it('produces expected sha256 signature', () => {
    const secret = 'supersecret';
    const payload = { a: 1, b: 'x' };
    const ts = 1700000000;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${JSON.stringify(payload)}`)
      .digest('hex');
    const sig = signWebhook(secret, payload, ts);
    expect(sig).toBe(`sha256=${expected}`);
  });
});

describe('webhooks.dispatchPendingDeliveries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    jest.resetModules();
    mockedCreateClient.mockClear();
    (global.fetch as any) = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('processes claimed delivery successfully and completes it', async () => {
    // Arrange: one claimed delivery
    const claims = [
      {
        delivery_id: 'd1',
        url: 'https://example.org/hook',
        secret: 'whsec_123',
        event_type: 'note.created',
        event_data: { foo: 'bar' },
        attempt_number: 1,
        max_attempts: 3,
        timeout_seconds: 2,
      },
    ];

    // First rpc: claim_pending_deliveries returns claims
    // Second rpc: complete_delivery called with success=true
    mockRpcImplementation([
      () => Promise.resolve({ data: claims, error: null }),
      (_fn, args) => {
        expect(_fn).toBe('complete_delivery');
        expect(args).toMatchObject({
          p_delivery_id: 'd1',
          p_success: true,
          p_response_status: 200,
          p_next_retry_at: null,
        });
        return Promise.resolve({ data: null, error: null });
      },
    ]);

    // Mock fetch 200 OK
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      ok: true,
      text: () => Promise.resolve('ok'),
    });

    // Act
    const result = await dispatchPendingDeliveries(10);

    // Assert
    expect(result).toEqual({ processed: 1, successes: 1, failures: 0 });
    // Verify headers were sent
    const fetchArgs = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchArgs[1].headers;
    expect(headers['X-SS-Event']).toBe('note.created');
    expect(headers['X-SS-Delivery-Id']).toBe('d1');
    expect(typeof headers['X-SS-Signature']).toBe('string');
  });

  it('retries failed delivery and schedules next_retry_at', async () => {
    const claims = [
      {
        delivery_id: 'd2',
        url: 'https://example.org/hook',
        secret: 'whsec_456',
        event_type: 'note.updated',
        event_data: { id: 'n1' },
        attempt_number: 2, // second attempt → 5m backoff
        max_attempts: 4,
        timeout_seconds: 2,
      },
    ];

    mockRpcImplementation([
      () => Promise.resolve({ data: claims, error: null }),
      (_fn, args) => {
        expect(_fn).toBe('complete_delivery');
        expect(args.p_success).toBe(false);
        expect(args.p_response_status).toBe(500);
        // attempt_number=2 → backoffs[1] = 300s
        const expectedNext = new Date(Date.now() + 300 * 1000).toISOString();
        expect(args.p_next_retry_at).toBe(expectedNext);
        return Promise.resolve({ data: null, error: null });
      },
    ]);

    // Mock fetch 500
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 500,
      ok: false,
      text: () => Promise.resolve('err'),
    });

    const result = await dispatchPendingDeliveries(10);
    expect(result).toEqual({ processed: 1, successes: 0, failures: 1 });
  });

  it('handles network error and marks failure', async () => {
    const claims = [
      {
        delivery_id: 'd3',
        url: 'https://example.org/hook',
        secret: 'whsec_789',
        event_type: 'note.deleted',
        event_data: { id: 'n2' },
        attempt_number: 1, // first attempt → 60s backoff
        max_attempts: 1, // but max attempts reached → next_retry_at null
        timeout_seconds: 1,
      },
    ];

    mockRpcImplementation([
      () => Promise.resolve({ data: claims, error: null }),
      (_fn, args) => {
        expect(_fn).toBe('complete_delivery');
        expect(args.p_success).toBe(false);
        expect(args.p_error_message).toBeDefined();
        // max_attempts=1 and attempt_number=1 → willRetry=false → p_next_retry_at null
        expect(args.p_next_retry_at).toBeNull();
        return Promise.resolve({ data: null, error: null });
      },
    ]);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network down'));

    const result = await dispatchPendingDeliveries(10);
    expect(result).toEqual({ processed: 1, successes: 0, failures: 1 });
  });
});
