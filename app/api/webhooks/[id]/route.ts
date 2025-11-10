import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

type IdParams = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: IdParams }) {
  const _logger = createRequestLogger(req);
  const { id } = await params;
  try {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('webhooks')
      .select('id, url, description, events, is_active, created_at, updated_at, last_triggered_at, total_deliveries, successful_deliveries, failed_deliveries')
      .eq('id', id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }
    return NextResponse.json({ webhook: data });
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to fetch webhook' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: IdParams }) {
  const _logger = createRequestLogger(req);
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    for (const key of ['url','description','events','is_active','retry_attempts','timeout_seconds']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updates[key] = (body as Record<string, unknown>)[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    if (updates.url) {
      try { new URL(String(updates.url)); } catch { return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 }); }
    }
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .select('id, url, description, events, is_active, updated_at, created_at')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }
    return NextResponse.json({ webhook: data });
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: IdParams }) {
  const { id } = await params;
  try {
    const supabase = await getServerSupabase();
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Webhook deleted' });
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
