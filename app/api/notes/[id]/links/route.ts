import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * GET /api/notes/[id]/links
 * Retrieve all linked notes (both source and target relationships)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const noteId = Number(resolvedParams.id);
    if (!noteId || Number.isNaN(noteId)) {
      logger.warn('Invalid note id for links');
      return NextResponse.json({ error: 'Invalid note id' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    // Verify note exists and user has access
    const { data: note, error: noteErr } = await supabase
      .from('notes')
      .select('id, user_id')
      .eq('id', noteId)
      .single();

    if (noteErr || !note) {
      logger.warn('Note not found for links', undefined, { supabaseError: noteErr || null });
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Get all links where this note is either source or target
    const { data: sourceLinks, error: sourceErr } = await supabase
      .from('note_links')
      .select(`
        id,
        target_note_id,
        similarity_score,
        link_type,
        created_by,
        created_at,
        target:notes!target_note_id (
          id,
          summary,
          original_notes,
          created_at
        )
      `)
      .eq('source_note_id', noteId)
      .order('similarity_score', { ascending: false });

    const { data: targetLinks, error: targetErr } = await supabase
      .from('note_links')
      .select(`
        id,
        source_note_id,
        similarity_score,
        link_type,
        created_by,
        created_at,
        source:notes!source_note_id (
          id,
          summary,
          original_notes,
          created_at
        )
      `)
      .eq('target_note_id', noteId)
      .order('similarity_score', { ascending: false });

    if (sourceErr || targetErr) {
        logger.error('Failed to fetch note links', (sourceErr || targetErr) as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    // Combine and format results
    type SourceLink = { id: number; target_note_id: number; similarity_score: number; link_type: string; created_by: string; created_at: string; target: { id: number; summary: string | null; original_notes: string | null; created_at: string }[] };
    type TargetLink = { id: number; source_note_id: number; similarity_score: number; link_type: string; created_by: string; created_at: string; source: { id: number; summary: string | null; original_notes: string | null; created_at: string }[] };

    const outgoing = ((sourceLinks || []) as SourceLink[]).map(link => ({
      id: link.id,
      note_id: link.target_note_id,
      similarity_score: link.similarity_score,
      link_type: link.link_type,
      created_by: link.created_by,
      created_at: link.created_at,
      direction: 'outgoing' as const,
      note: Array.isArray(link.target) ? link.target[0] : link.target
    }));

    const incoming = ((targetLinks || []) as TargetLink[]).map(link => ({
      id: link.id,
      note_id: link.source_note_id,
      similarity_score: link.similarity_score,
      link_type: link.link_type,
      created_by: link.created_by,
      created_at: link.created_at,
      direction: 'incoming' as const,
      note: Array.isArray(link.source) ? link.source[0] : link.source
    }));

    const allLinks = [...outgoing, ...incoming].sort((a, b) => 
      (b.similarity_score || 0) - (a.similarity_score || 0)
    );

    const duration = Date.now() - start;
    logger.info('Note links fetched', undefined, { noteId, linkCount: allLinks.length, duration });
    logger.logResponse('GET', `/api/notes/${noteId}/links`, 200, duration);

    return NextResponse.json({ 
      links: allLinks,
      count: allLinks.length,
      outgoing_count: outgoing.length,
      incoming_count: incoming.length
    });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error fetching note links', error as Error);
    logger.logResponse('GET', `/api/notes/${resolvedParams?.id ?? '[id]'}/links`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/notes/[id]/links
 * Create a manual link between notes or auto-discover links
 * Body: { target_note_id?: number, auto_discover?: boolean, min_similarity?: number }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const noteId = Number(resolvedParams.id);
    if (!noteId || Number.isNaN(noteId)) {
      logger.warn('Invalid note id for creating link');
      return NextResponse.json({ error: 'Invalid note id' }, { status: 400 });
    }

    const body = await req.json();
    const { target_note_id, auto_discover, min_similarity = 0.78 } = body;

    const supabase = await getServerSupabase();

    // Verify source note exists and user has access
    const { data: sourceNote, error: sourceErr } = await supabase
      .from('notes')
      .select('id, user_id, embedding')
      .eq('id', noteId)
      .single();

    if (sourceErr || !sourceNote) {
      logger.warn('Source note not found', undefined, { supabaseError: sourceErr || null });
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Auto-discover links
    if (auto_discover) {
      if (!sourceNote.embedding) {
        logger.warn('Note has no embedding for auto-discovery');
        return NextResponse.json({ error: 'Note has no embedding' }, { status: 400 });
      }

      const { data: linkedNotes, error: rpcErr } = await supabase.rpc('auto_link_related_notes', {
        p_note_id: noteId,
        p_min_similarity: min_similarity,
        p_max_links: 5
      });

      if (rpcErr) {
        logger.error('Auto-discover RPC failed', rpcErr as unknown as Error);
        return NextResponse.json({ error: 'Failed to auto-discover links' }, { status: 500 });
      }

      const duration = Date.now() - start;
      logger.info('Auto-discovered note links', undefined, { noteId, linkCount: (linkedNotes as unknown[])?.length || 0, duration });
      logger.logResponse('POST', `/api/notes/${noteId}/links`, 200, duration);

      return NextResponse.json({ 
        success: true,
        links: linkedNotes || [],
        count: (linkedNotes as unknown[])?.length || 0
      });
    }

    // Manual link creation
    if (!target_note_id) {
      logger.warn('Missing target_note_id for manual link');
      return NextResponse.json({ error: 'target_note_id is required' }, { status: 400 });
    }

    // Verify target note exists and user has access
    const { data: targetNote, error: targetErr } = await supabase
      .from('notes')
      .select('id, user_id')
      .eq('id', target_note_id)
      .single();

    if (targetErr || !targetNote) {
      logger.warn('Target note not found', undefined, { supabaseError: targetErr || null });
      return NextResponse.json({ error: 'Target note not found' }, { status: 404 });
    }

    // Verify both notes belong to the same user
    if (sourceNote.user_id !== targetNote.user_id) {
      logger.warn('Cannot link notes from different users');
      return NextResponse.json({ error: 'Cannot link notes from different users' }, { status: 403 });
    }

    // Create the link
    const { data: link, error: linkErr } = await supabase
      .from('note_links')
      .insert({
        source_note_id: noteId,
        target_note_id: target_note_id,
        user_id: sourceNote.user_id,
        link_type: 'manual',
        created_by: 'user'
      })
      .select()
      .single();

    if (linkErr) {
      if (linkErr.message?.includes('unique_note_link')) {
        logger.warn('Link already exists');
        return NextResponse.json({ error: 'Link already exists' }, { status: 409 });
      }
      logger.error('Failed to create link', linkErr as unknown as Error);
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Manual note link created', undefined, { noteId, targetNoteId: target_note_id, duration });
    logger.logResponse('POST', `/api/notes/${noteId}/links`, 201, duration);

    return NextResponse.json({ success: true, link }, { status: 201 });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error creating note link', error as Error);
    logger.logResponse('POST', `/api/notes/${resolvedParams?.id ?? '[id]'}/links`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/notes/[id]/links
 * Remove a specific link
 * Query params: link_id (required)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const noteId = Number(resolvedParams.id);
    const url = new URL(req.url);
    const linkId = Number(url.searchParams.get('link_id'));

    if (!noteId || Number.isNaN(noteId) || !linkId || Number.isNaN(linkId)) {
      logger.warn('Invalid note id or link id');
      return NextResponse.json({ error: 'Invalid note id or link id' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    // Delete the link (RLS will ensure user owns it)
    const { error: deleteErr } = await supabase
      .from('note_links')
      .delete()
      .eq('id', linkId)
      .or(`source_note_id.eq.${noteId},target_note_id.eq.${noteId}`);

    if (deleteErr) {
      logger.error('Failed to delete link', deleteErr as unknown as Error);
      return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Note link deleted', undefined, { noteId, linkId, duration });
    logger.logResponse('DELETE', `/api/notes/${noteId}/links`, 200, duration);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error deleting note link', error as Error);
    logger.logResponse('DELETE', `/api/notes/${resolvedParams?.id ?? '[id]'}/links`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
