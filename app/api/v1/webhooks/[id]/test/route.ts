import { NextResponse } from 'next/server';
import { withApiMiddleware } from '@/lib/apiMiddleware';
import { createClient } from '@supabase/supabase-js';
import { signWebhook } from '@/lib/webhooks';

/**
 * POST /api/v1/webhooks/[id]/test
 * Test a webhook by sending a test event
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export const POST = withApiMiddleware(async (req, { userId }) => {
  const supabaseAdmin = getSupabaseAdmin();
  const webhookId = req.url.split('/').slice(-2)[0];

  const { data: webhook, error } = await supabaseAdmin
    .from('webhooks')
    .select('id, url, secret')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .single();
  if (error || !webhook) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const payload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test webhook from Smart Summarizer.' },
    user_id: userId,
  };
  const ts = Math.floor(Date.now() / 1000);
  const signature = signWebhook(webhook.secret, payload, ts);
  const started = Date.now();
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartSummarizer/1.0 Webhook-Test',
        'X-SS-Event': 'webhook.test',
        'X-SS-Signature': signature,
        'X-SS-Timestamp': ts.toString(),
        'X-SS-Delivery-Id': 'test',
      },
      body: JSON.stringify(payload),
    });
    const ms = Date.now() - started;
    if (res.ok) {
      return NextResponse.json({ success: true, statusCode: res.status, responseTime: ms });
    } else {
      return NextResponse.json({ success: false, statusCode: res.status, responseTime: ms }, { status: 400 });
    }
  } catch (e: unknown) {
    const ms = Date.now() - started;
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message, responseTime: ms }, { status: 400 });
  }
});
