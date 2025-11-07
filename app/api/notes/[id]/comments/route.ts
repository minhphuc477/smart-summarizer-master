import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/notes/[id]/comments - Get all comments for a note
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const noteId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('GET', `/api/notes/${noteId}/comments`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify note access
    const { data: note } = await supabase
      .from('notes')
      .select('id, user_id, is_public')
      .eq('id', noteId)
      .single();

    if (!note) {
      logger.logResponse('GET', `/api/notes/${noteId}/comments`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.user_id !== user.id && !note.is_public) {
      logger.logResponse('GET', `/api/notes/${noteId}/comments`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all comments with user info
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:user_id (
          email,
          raw_user_meta_data
        ),
        reactions:comment_reactions (
          id,
          reaction_type,
          user_id
        )
      `)
      .eq('note_id', noteId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.logResponse('GET', `/api/notes/${noteId}/comments`, 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format comments into a tree structure
    const commentMap = new Map();
    const rootComments: unknown[] = [];

    // First pass: create map of all comments
    comments?.forEach((comment) => {
      commentMap.set(comment.id, {
        ...comment,
        user_name: comment.user?.raw_user_meta_data?.name || comment.user?.email || 'Anonymous',
        user_email: comment.user?.email,
        user_avatar: comment.user?.raw_user_meta_data?.avatar_url,
        replies: [],
      });
    });

    // Second pass: build tree structure
    comments?.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id);
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    logger.logResponse('GET', `/api/notes/${noteId}/comments`, 200, Date.now() - startTime);
    return NextResponse.json({ comments: rootComments });
  } catch (_error) {
    logger.logResponse('GET', `/api/notes/${noteId}/comments`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes/[id]/comments - Create a new comment
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  const params = await context.params;
  const noteId = params.id;

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.logResponse('POST', `/api/notes/${noteId}/comments`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { content, parent_id, canvas_node_id, mentions = [] } = body;

    if (!content || content.trim().length === 0) {
      logger.logResponse('POST', `/api/notes/${noteId}/comments`, 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify note access
    const { data: note } = await supabase
      .from('notes')
      .select('id, user_id, is_public')
      .eq('id', noteId)
      .single();

    if (!note) {
      logger.logResponse('POST', `/api/notes/${noteId}/comments`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.user_id !== user.id && !note.is_public) {
      logger.logResponse('POST', `/api/notes/${noteId}/comments`, 403, Date.now() - startTime);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse @mentions from content if not provided
    const mentionsList = mentions.length === 0 ? [] : [...mentions];
    if (mentions.length === 0) {
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        mentionsList.push(match[2]); // Extract user ID
      }
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        note_id: noteId,
        user_id: user.id,
        parent_id: parent_id || null,
        canvas_node_id: canvas_node_id || null,
        content,
        mentions: mentionsList,
      })
      .select(`
        *,
        user:user_id (
          email,
          raw_user_meta_data
        )
      `)
      .single();

    if (error) {
      logger.logResponse('POST', `/api/notes/${noteId}/comments`, 500, Date.now() - startTime);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.logResponse('POST', `/api/notes/${noteId}/comments`, 201, Date.now() - startTime);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (_error) {
    logger.logResponse('POST', `/api/notes/${noteId}/comments`, 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
