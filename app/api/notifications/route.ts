import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/notifications - Get user's notifications
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const searchParams = req.nextUrl.searchParams;
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('GET', '/api/notifications', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      logger.logResponse('GET', '/api/notifications', 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    logger.logResponse('GET', '/api/notifications', 200, Date.now() - startTime);
    return NextResponse.json({ 
      notifications,
      unread_count: unreadCount || 0,
    });
  } catch (_error) {
    logger.logResponse('GET', '/api/notifications', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications - Mark notifications as read
 */
export async function PATCH(req: NextRequest) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('PATCH', '/api/notifications', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { notification_ids, mark_all_read } = body;

    if (mark_all_read) {
      // Mark all notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        logger.logResponse('PATCH', '/api/notifications', 500, Date.now() - startTime);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logger.logResponse('PATCH', '/api/notifications', 200, Date.now() - startTime);
      return NextResponse.json({ success: true });
    } else if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .in('id', notification_ids)
        .eq('user_id', user.id);

      if (error) {
        logger.logResponse('PATCH', '/api/notifications', 500, Date.now() - startTime);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logger.logResponse('PATCH', '/api/notifications', 200, Date.now() - startTime);
      return NextResponse.json({ success: true });
    } else {
      logger.logResponse('PATCH', '/api/notifications', 400, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Either notification_ids or mark_all_read must be provided' },
        { status: 400 }
      );
    }
  } catch (_error) {
    logger.logResponse('PATCH', '/api/notifications', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
