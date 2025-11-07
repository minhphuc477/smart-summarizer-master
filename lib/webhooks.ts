import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Lazy initialize to avoid build-time errors
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}

export type WebhookEvent = 'note.created' | 'note.updated' | 'note.deleted';

export const AllowedWebhookEvents: WebhookEvent[] = [
  'note.created',
  'note.updated',
  'note.deleted',
];

export function signWebhook(secret: string, payload: object, timestamp: number): string {
  const raw = `${timestamp}.${JSON.stringify(payload)}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(raw, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

export async function enqueueWebhook(userId: string, event: WebhookEvent, data: unknown) {
  const supabase = getSupabaseAdmin();
  // Use DB function to create deliveries for all subscribed webhooks
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    user_id: userId,
  };
  const rpcClient = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  };
  const { error } = await rpcClient.rpc('trigger_webhook', {
    p_event_type: event,
    p_event_data: payload,
    p_user_id: userId,
  });
  if (error) {
    console.error('Failed to enqueue webhook:', error);
  }
}

export async function dispatchPendingDeliveries(limit = 10) {
  const supabase = getSupabaseAdmin();
  const rpcClient = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  };
  // Claim a batch
  const { data: claims, error } = await rpcClient.rpc('claim_pending_deliveries', {
    p_limit: limit,
  });
  if (error) {
    console.error('Failed to claim deliveries:', error);
    return { processed: 0, successes: 0, failures: 0 };
  }

  interface DeliveryClaim {
    delivery_id: string;
    url: string;
    secret: string;
    event_type: string;
    event_data: unknown;
    attempt_number: number;
    max_attempts: number;
    timeout_seconds?: number;
  }

  const deliveries = ((claims || []) as unknown as DeliveryClaim[]);
  let successes = 0;
  let failures = 0;

  for (const d of deliveries) {
    const deliveryId = d.delivery_id;
    const url: string = d.url;
    const secret: string = d.secret;
    const eventType: string = d.event_type;
    const eventData: unknown = d.event_data;
    const attemptNumber: number = d.attempt_number;
    const maxAttempts: number = d.max_attempts;
    const timeoutSeconds: number = d.timeout_seconds || 10;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    const ts = Math.floor(Date.now() / 1000);
    const bodyPayload = (typeof eventData === 'object' && eventData !== null) ? (eventData as object) : { data: eventData };
    const signature = signWebhook(secret, bodyPayload, ts);

    let responseStatus = 0;
    let responseBody = '';
    let errorMessage = '';
    let nextRetryAt: string | null = null;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartSummarizer/1.0 Webhook-Dispatcher',
          'X-SS-Event': eventType,
          'X-SS-Signature': signature,
          'X-SS-Timestamp': ts.toString(),
          'X-SS-Delivery-Id': deliveryId,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      responseStatus = res.status;
      responseBody = await res.text();

      const ok = res.status >= 200 && res.status < 300;
      if (ok) {
        successes++;
        await rpcClient.rpc('complete_delivery', {
          p_delivery_id: deliveryId,
          p_success: true,
          p_response_status: responseStatus,
          p_response_body: responseBody,
          p_error_message: null,
          p_next_retry_at: null,
        });
      } else {
        // Backoff: 1m, 5m, 15m, 60m
        const backoffs = [60, 300, 900, 3600];
        const idx = Math.min(attemptNumber - 1, backoffs.length - 1);
        const waitSec = backoffs[idx];
        const willRetry = attemptNumber < maxAttempts;
        nextRetryAt = willRetry ? new Date(Date.now() + waitSec * 1000).toISOString() : null;
        failures++;
        await rpcClient.rpc('complete_delivery', {
          p_delivery_id: deliveryId,
          p_success: false,
          p_response_status: responseStatus,
          p_response_body: responseBody,
          p_error_message: `HTTP ${responseStatus}`,
          p_next_retry_at: nextRetryAt,
        });
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : 'Network error';
      const backoffs = [60, 300, 900, 3600];
      const idx = Math.min(attemptNumber - 1, backoffs.length - 1);
      const waitSec = backoffs[idx];
      const willRetry = attemptNumber < maxAttempts;
      nextRetryAt = willRetry ? new Date(Date.now() + waitSec * 1000).toISOString() : null;
      failures++;
      await rpcClient.rpc('complete_delivery', {
        p_delivery_id: deliveryId,
        p_success: false,
        p_response_status: responseStatus,
        p_response_body: responseBody,
        p_error_message: errorMessage,
        p_next_retry_at: nextRetryAt,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return { processed: deliveries.length, successes, failures };
}
