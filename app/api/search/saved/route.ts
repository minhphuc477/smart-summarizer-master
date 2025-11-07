import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

// Assumes a table `saved_searches` with columns:
// id (serial), user_id (uuid/text), name (text), query (text), filters (jsonb), created_at, updated_at

export async function GET(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  try {
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get('userId');

    const supabase = await getServerSupabase();

    // Resolve userId: prefer explicit query param, else session user
    let userId = userIdParam || undefined;
    if (!userId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id;
      } catch (_err) {
        // ignore auth resolution errors; treat as unauthenticated
      }
    }

    // If still no user, return empty list gracefully (avoid noisy 401s in guest mode)
    if (!userId) {
      const duration = Date.now() - start;
      logger.warn('No user resolved for saved searches GET; returning empty list');
      logger.logResponse('GET', '/api/search/saved', 200, duration);
      return NextResponse.json({ items: [] });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .select('id, name, query, filters')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      const msg = (error as unknown as { message?: string; code?: string })?.message || '';
      const code = (error as unknown as { code?: string })?.code;
      // If table doesn't exist (e.g., migration not yet applied), return empty
      // Handle both Postgres error codes and Supabase schema cache messages
      if (
        code === '42P01' || 
        /relation .*saved_searches.* does not exist/i.test(msg) ||
        /could not find.*saved_searches.*in.*schema/i.test(msg)
      ) {
        const duration = Date.now() - start;
        logger.warn('saved_searches table missing; returning empty list', { userId });
        logger.logResponse('GET', '/api/search/saved', 200, duration, { userId });
        return NextResponse.json({ items: [] });
      }
      logger.error('Failed to load saved searches', error as Error, { userId });
      return NextResponse.json({ error: 'Failed to load saved searches' }, { status: 500 });
    }

    // Coerce filters to objects if they somehow come back as strings
    const items = (data || []).map((row: { id: string; name: string; query: string; filters: unknown }) => {
      let filters = row.filters as unknown;
      if (typeof filters === 'string') {
        try {
          filters = JSON.parse(filters);
        } catch {
          filters = null;
        }
      }
      return { ...row, filters };
    });

    const duration = Date.now() - start;
    logger.logResponse('GET', '/api/search/saved', 200, duration, { userId });
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error in saved searches GET', error as Error);
    logger.logResponse('GET', '/api/search/saved', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  try {
    const supabase = await getServerSupabase();

    // Parse body and normalize filters to JSON
    const body = await req.json().catch(() => ({}));
    let { userId, filters } = body || {};
    const { name, query } = body || {};

    // Allow session-based user ID if not explicitly provided
    if (!userId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id;
      } catch (_err) {
        // ignore
      }
    }

    if (!userId) {
      logger.warn('Unauthenticated saved search POST attempt');
      const duration = Date.now() - start;
      logger.logResponse('POST', '/api/search/saved', 401, duration);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!name || !query) {
      logger.warn('Missing fields for saved search POST', { userId, hasName: !!name, hasQuery: !!query });
      return NextResponse.json({ error: 'name and query are required' }, { status: 400 });
    }

    if (typeof filters === 'string') {
      try {
        filters = JSON.parse(filters);
      } catch {
        filters = null;
      }
    }

    // Upsert by (user_id, name)
    const { data, error } = await supabase
      .from('saved_searches')
      .upsert({ user_id: userId, name, query, filters: filters || null }, { onConflict: 'user_id,name' })
      .select('id, name, query, filters')
      .single();

    if (error) {
      const msg = (error as unknown as { message?: string; code?: string })?.message || '';
      const code = (error as unknown as { code?: string })?.code;
      if (
        code === '42P01' || 
        /relation .*saved_searches.* does not exist/i.test(msg) ||
        /could not find.*saved_searches.*in.*schema/i.test(msg)
      ) {
        // Table missing — surface a clearer error to guide migrations
        logger.warn('saved_searches table missing during POST');
        return NextResponse.json({ error: 'Saved searches not available. Run the latest database migrations.' }, { status: 503 });
      }
      logger.error('Failed to save search', error as Error, { userId });
      return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.logResponse('POST', '/api/search/saved', 200, duration, { userId });
    return NextResponse.json({ ok: true, item: data });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error in saved searches POST', error as Error);
    logger.logResponse('POST', '/api/search/saved', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
