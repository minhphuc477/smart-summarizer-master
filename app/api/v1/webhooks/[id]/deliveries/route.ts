import { NextResponse } from 'next/server';
import { withApiMiddleware } from '@/lib/apiMiddleware';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET /api/v1/webhooks/[id]/deliveries
 * Get delivery history for a webhook
 */
export const GET = withApiMiddleware(async (req, { userId }) => {
  const supabaseAdmin = getSupabaseAdmin();
  const webhookId = req.url.split('/').slice(-2)[0];
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const status = searchParams.get('status') || undefined;
  const offset = (page - 1) * limit;

  // Verify ownership
  const { data: owned, error: ownErr } = await supabaseAdmin
    .from('webhooks')
    .select('id')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .single();
  if (ownErr || !owned) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  let query = supabaseAdmin
    .from('webhook_deliveries')
    .select('id, event_type, event_data, status, attempt_number, max_attempts, response_status, error_message, created_at, delivered_at', { count: 'exact' })
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
  return NextResponse.json({ deliveries: data || [], pagination: { page, limit, total: count || 0 } });
});
