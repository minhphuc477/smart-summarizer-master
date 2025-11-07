import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * PATCH /api/comments/[id] - Update a comment
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const commentId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('PATCH', `/api/comments/${commentId}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { content, resolved } = body;

    // Get comment to verify ownership
    const { data: comment } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (!comment) {
      logger.logResponse('PATCH', `/api/comments/${commentId}`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only comment owner can edit content
    if (content !== undefined && comment.user_id !== user.id) {
      logger.logResponse('PATCH', `/api/comments/${commentId}`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    
    if (content !== undefined) {
      updates.content = content;
      updates.edited = true;
      updates.edited_at = new Date().toISOString();
    }

    if (resolved !== undefined) {
      // Anyone with note access can resolve threads
      updates.resolved = resolved;
      if (resolved) {
        updates.resolved_by = user.id;
        updates.resolved_at = new Date().toISOString();
      } else {
        updates.resolved_by = null;
        updates.resolved_at = null;
      }
    }

    const { data: updated, error } = await supabase
      .from('comments')
      .update(updates)
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      logger.logResponse('PATCH', `/api/comments/${commentId}`, 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.logResponse('PATCH', `/api/comments/${commentId}`, 200, Date.now() - startTime);
    return NextResponse.json({ comment: updated });
  } catch (_error) {
    logger.logResponse('PATCH', `/api/comments/${commentId}`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comments/[id] - Delete a comment
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const commentId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('DELETE', `/api/comments/${commentId}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!comment) {
      logger.logResponse('DELETE', `/api/comments/${commentId}`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.user_id !== user.id) {
      logger.logResponse('DELETE', `/api/comments/${commentId}`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      logger.logResponse('DELETE', `/api/comments/${commentId}`, 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.logResponse('DELETE', `/api/comments/${commentId}`, 204, Date.now() - startTime);
    return new NextResponse(null, { status: 204 });
  } catch (_error) {
    logger.logResponse('DELETE', `/api/comments/${commentId}`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comments/[id]/react - Add a reaction to a comment
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const commentId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('POST', `/api/comments/${commentId}/react`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { reaction_type } = body;

    const validReactions = ['like', 'heart', 'thumbsup', 'celebrate', 'insightful'];
    if (!validReactions.includes(reaction_type)) {
      logger.logResponse('POST', `/api/comments/${commentId}/react`, 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 });
    }

    // Toggle reaction (remove if exists, add if doesn't)
    const { data: existing } = await supabase
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .eq('reaction_type', reaction_type)
      .single();

    if (existing) {
      // Remove reaction
      await supabase
        .from('comment_reactions')
        .delete()
        .eq('id', existing.id);
      
      logger.logResponse('POST', `/api/comments/${commentId}/react`, 200, Date.now() - startTime);
      return NextResponse.json({ removed: true });
    } else {
      // Add reaction
      const { data: reaction, error } = await supabase
        .from('comment_reactions')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          reaction_type,
        })
        .select()
        .single();

      if (error) {
        logger.logResponse('POST', `/api/comments/${commentId}/react`, 500, Date.now() - startTime);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logger.logResponse('POST', `/api/comments/${commentId}/react`, 201, Date.now() - startTime);
      return NextResponse.json({ reaction }, { status: 201 });
    }
  } catch (_error) {
    logger.logResponse('POST', `/api/comments/${commentId}/react`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
