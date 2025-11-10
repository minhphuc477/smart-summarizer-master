import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';
import crypto from 'crypto';

type IdParams = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: IdParams }) {
  const logger = createRequestLogger(req);
  const { id } = await params;
  
  try {
    const supabase = await getServerSupabase();
    
    // Fetch webhook with secret
    const { data: webhook, error: fetchErr } = await supabase
      .from('webhooks')
      .select('id, url, secret, is_active')
      .eq('id', id)
      .single();
    
    if (fetchErr || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }
    
    if (!webhook.is_active) {
      return NextResponse.json({ error: 'Webhook is not active' }, { status: 400 });
    }
    
    // Create test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from Smart Summarizer',
        webhook_id: webhook.id,
      },
    };
    
    // Sign the payload
    const ts = Math.floor(Date.now() / 1000);
    const raw = `${ts}.${JSON.stringify(testPayload)}`;
    const hmac = crypto.createHmac('sha256', webhook.secret);
    hmac.update(raw, 'utf8');
    const signature = `sha256=${hmac.digest('hex')}`;
    
    // Send test webhook
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartSummarizer/1.0 Webhook-Test',
          'X-SS-Event': 'webhook.test',
          'X-SS-Signature': signature,
          'X-SS-Timestamp': ts.toString(),
          'X-SS-Delivery-Id': crypto.randomUUID(),
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      const responseText = await response.text().catch(() => '');
      
      logger.info('Test webhook sent', undefined, {
        webhookId: id,
        url: webhook.url,
        status: response.status,
      });
      
      return NextResponse.json({
        success: true,
        status: response.status,
        response: responseText.substring(0, 500),
        message: 'Test webhook sent successfully',
      });
      
    } catch (fetchError: unknown) {
      clearTimeout(timeout);
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Network error';
      
      logger.error('Test webhook failed', fetchError as Error, { webhookId: id });
      
      return NextResponse.json({
        success: false,
        error: errorMsg,
        message: 'Failed to deliver test webhook',
      }, { status: 500 });
    }
    
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to send test webhook' }, { status: 500 });
  }
}
