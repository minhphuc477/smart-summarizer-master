import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

/**
 * POST /api/notes/[id]/auto-categorize
 * Manually trigger auto-categorization for a specific note
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
      logger.warn('Invalid note id for auto-categorization');
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
      logger.warn('Note not found for auto-categorization', undefined, { supabaseError: noteErr || null });
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Call the auto-categorization function
    const { data: assignments, error: rpcErr } = await supabase.rpc('auto_categorize_note', {
      p_note_id: noteId
    });

    if (rpcErr) {
      logger.error('Auto-categorization RPC failed', rpcErr as unknown as Error);
      return NextResponse.json({ error: 'Failed to auto-categorize note' }, { status: 500 });
    }

    const duration = Date.now() - start;
    logger.info('Note auto-categorized', undefined, { noteId, assignmentCount: (assignments as unknown[])?.length || 0, duration });
    logger.logResponse('POST', `/api/notes/${noteId}/auto-categorize`, 200, duration);

    return NextResponse.json({ 
      success: true,
      assignments: assignments || [],
      count: (assignments as unknown[])?.length || 0
    });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error auto-categorizing note', error as Error);
    logger.logResponse('POST', `/api/notes/${resolvedParams?.id ?? '[id]'}/auto-categorize`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
