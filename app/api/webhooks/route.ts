import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function GET(req: Request) {
  const logger = createRequestLogger(req);
  try {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('webhooks')
      .select('id, url, description, events, is_active, created_at, updated_at, last_triggered_at, total_deliveries, successful_deliveries, failed_deliveries')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('Failed to list webhooks', error as Error);
      return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
    }

    return NextResponse.json({ webhooks: data || [] });
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const logger = createRequestLogger(req);
  try {
    const body = await req.json().catch(() => ({}));
    const { url, events, enabled = true, description, retry_attempts = 3, timeout_seconds = 10 } = body;
    if (!url || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'url and events[] are required' }, { status: 400 });
    }

    // Generate a random secret on server for HMAC signatures
    const secret = (await import('crypto')).randomBytes(24).toString('hex');

    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        url,
        secret,
        description: description || null,
        events,
        is_active: !!enabled,
        retry_attempts,
        timeout_seconds,
      })
      .select('id, url, description, events, is_active, created_at, last_triggered_at')
      .single();

    if (error || !data) {
      logger.error('Failed to create webhook', error as Error);
      return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }

    return NextResponse.json({ webhook: data }, { status: 201 });
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
