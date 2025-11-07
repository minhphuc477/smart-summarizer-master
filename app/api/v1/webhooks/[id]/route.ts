import { NextResponse } from 'next/server';
import { withApiMiddleware, requireScope } from '@/lib/apiMiddleware';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET /api/v1/webhooks/[id]
 * Get a specific webhook
 */
export const GET = withApiMiddleware(async (req, { userId }) => {
  const supabaseAdmin = getSupabaseAdmin();
  const webhookId = req.url.split('/').slice(-1)[0];
  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .select('id, url, description, events, is_active, created_at, updated_at, last_triggered_at, total_deliveries, successful_deliveries, failed_deliveries')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  return NextResponse.json(data);
});

/**
 * PUT /api/v1/webhooks/[id]
 * Update a webhook
 */
export const PUT = withApiMiddleware(async (req, { userId, scopes }) => {
  const supabaseAdmin = getSupabaseAdmin();
  try { requireScope(scopes, 'webhooks:write'); } catch (e: unknown) {
    return NextResponse.json({ error: 'Forbidden', message: e instanceof Error ? e.message : 'Access denied' }, { status: 403 });
  }
  const webhookId = req.url.split('/').slice(-1)[0];
  const body: Partial<{ url: string; description: string | null; events: string[]; filters: unknown; is_active: boolean; retry_attempts: number; timeout_seconds: number }> = await req.json().catch(() => ({}));

  // Validate URL if provided
  if (body.url) {
    try { new URL(body.url); } catch { return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 }); }
  }
  // Validate events if provided
  if (body.events) {
    const validEvents = ['note.created','note.updated','note.deleted'];
    const invalid = body.events.filter((e: string) => !validEvents.includes(e));
    if (invalid.length) {
      return NextResponse.json({ error: 'Invalid events', details: invalid.join(', ') }, { status: 400 });
    }
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('webhooks')
    .select('id')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .single();
  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const updates: Partial<{ url: string; description: string | null; events: string[]; filters: unknown; is_active: boolean; retry_attempts: number; timeout_seconds: number }> = {};
  if (typeof body.url !== 'undefined') updates.url = body.url;
  if (typeof body.description !== 'undefined') updates.description = body.description;
  if (typeof body.events !== 'undefined') updates.events = body.events;
  if (typeof body.filters !== 'undefined') updates.filters = body.filters;
  if (typeof body.is_active !== 'undefined') updates.is_active = body.is_active;
  if (typeof body.retry_attempts !== 'undefined') updates.retry_attempts = body.retry_attempts;
  if (typeof body.timeout_seconds !== 'undefined') updates.timeout_seconds = body.timeout_seconds;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .update(updates)
    .eq('id', webhookId)
    .eq('user_id', userId)
    .select('id, url, description, events, is_active, created_at, updated_at')
    .single();
  if (error) {
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
  return NextResponse.json(data);
});

/**
 * DELETE /api/v1/webhooks/[id]
 * Delete a webhook
 */
export const DELETE = withApiMiddleware(async (req, { userId, scopes }) => {
  const supabaseAdmin = getSupabaseAdmin();
  try { requireScope(scopes, 'webhooks:delete'); } catch (e: unknown) {
    return NextResponse.json({ error: 'Forbidden', message: e instanceof Error ? e.message : 'Access denied' }, { status: 403 });
  }
  const webhookId = req.url.split('/').slice(-1)[0];
  const { error } = await supabaseAdmin
    .from('webhooks')
    .delete()
    .eq('id', webhookId)
    .eq('user_id', userId);
  if (error) {
    // PGRST116 not portable here; return 404 if no row deleted
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
  return NextResponse.json({ message: 'Webhook deleted successfully' });
});
