import { NextResponse } from 'next/server';
import { withApiMiddleware, requireScope } from '@/lib/apiMiddleware';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

function isValidUrl(url: string) {
  try { new URL(url); return true; } catch { return false; }
}

export const GET = withApiMiddleware(async (req, { userId, scopes }) => {
  const supabaseAdmin = getSupabaseAdmin();
  try { requireScope(scopes, 'webhooks:read'); } catch (e: unknown) {
    return NextResponse.json({ error: 'Forbidden', message: e instanceof Error ? e.message : 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('webhooks')
    .select('id, url, description, events, is_active, created_at, updated_at, last_triggered_at, total_deliveries, successful_deliveries, failed_deliveries', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }

  return NextResponse.json({
    webhooks: data || [],
    pagination: { page, limit, total: count || 0 }
  });
});

export const POST = withApiMiddleware(async (req, { userId, scopes }) => {
    const supabaseAdmin = getSupabaseAdmin();
  try { requireScope(scopes, 'webhooks:write'); } catch (e: unknown) {
    return NextResponse.json({ error: 'Forbidden', message: e instanceof Error ? e.message : 'Access denied' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { url, events, description, secret } = body;

  if (!url || !isValidUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  const allowedEvents = ['note.created','note.updated','note.deleted'];
  const ev: string[] = Array.isArray(events) && events.length ? events : allowedEvents;
  if (!ev.every((e) => allowedEvents.includes(e))) {
    return NextResponse.json({ error: 'Invalid events array' }, { status: 400 });
  }

  const finalSecret = typeof secret === 'string' && secret.length >= 16
    ? secret
    : crypto.randomBytes(32).toString('hex');

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .insert({ user_id: userId, url, secret: finalSecret, description: description || null, events: ev })
    .select('id, url, description, events, is_active, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }

  return NextResponse.json({ webhook: { ...data, secret: finalSecret } }, { status: 201 });
});
