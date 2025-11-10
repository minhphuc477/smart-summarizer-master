import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

type IdParams = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: IdParams }) {
  const { id } = await params;
  const logger = createRequestLogger(req);
  try {
    const supabase = await getServerSupabase();
    // basic ownership check via join
    const { data: hook, error: hookErr } = await supabase
      .from('webhooks')
      .select('id')
      .eq('id', id)
      .single();
    if (hookErr || !hook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('id, event_type, event_data, status, attempt_number, max_attempts, response_status, error_message, created_at, delivered_at')
      .eq('webhook_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Failed to list deliveries', error as Error);
      return NextResponse.json({ error: 'Failed to list deliveries' }, { status: 500 });
    }
    return NextResponse.json({ deliveries: data || [] });
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to list deliveries' }, { status: 500 });
  }
}
