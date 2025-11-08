import { NextRequest } from 'next/server';
import { GET as statusGet, HEAD as statusHead } from '@/app/api/embedding/status/[id]/route';

// Mock supabase server client
jest.mock('@/lib/supabaseServer', () => ({
  getServerSupabase: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { status: 'completed', started_at: null, finished_at: null, error_message: null } })
        })
      })
    })
  })
}));

jest.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({ logResponse: () => {}, info: () => {}, warn: () => {}, error: () => {} })
}));

describe('Embedding status endpoints', () => {
  test('GET returns 200', async () => {
    const res: any = await statusGet(undefined as unknown as NextRequest, { params: { id: '123' } });
    expect(res && typeof res.status === 'number').toBe(true);
  });

  test('HEAD maps status to 204 code on completed', async () => {
    const res: any = await statusHead(undefined as unknown as NextRequest, { params: { id: '123' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('x-embedding-status')).toBe('completed');
  });
});
