import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';
import { respondError } from '@/lib/apiErrors';

export async function POST(req: Request) {
  const logger = createRequestLogger(req);
  
  try {
    const { userId, eventType, metadata } = await req.json();

    if (!userId || !eventType) {
      const { body, status } = respondError('INVALID_INPUT', 'userId and eventType are required', 400);
      return NextResponse.json(body, { status });
    }

    const supabase = await getServerSupabase();

    // Insert usage event
    const { error } = await supabase
      .from('usage_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        metadata: metadata || {},
      });

    if (error) {
      logger.error('Failed to insert usage event', error as Error);
      // Don't fail the request - just log
      return NextResponse.json({ success: false }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error tracking usage event', error as Error);
    // Don't fail - tracking is non-critical
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
