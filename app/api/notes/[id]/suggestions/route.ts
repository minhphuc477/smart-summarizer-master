import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  const resolvedParams = await params;

  try {
    const noteId = resolvedParams.id;
    const url = new URL(req.url);
    const matchCount = Number(url.searchParams.get('matchCount') || 5);
    const matchThreshold = Number(url.searchParams.get('matchThreshold') || 0.78);

      if (!noteId || Number.isNaN(Number(noteId))) {
      logger.warn('Invalid note id');
      return NextResponse.json({ error: 'Invalid note id' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    // 1) Fetch the note to obtain its embedding and user_id
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id, embedding')
        .eq('id', noteId)
      .single();

    if (noteError || !note) {
      logger.error('Note not found or DB error', noteError as unknown as Error);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!note.embedding) {
      logger.warn('Note has no embedding');
      return NextResponse.json({ results: [], count: 0 });
    }

    // 2) Call RPC to find similar notes (filter by same user)
    const { data: matches, error: rpcError } = await supabase.rpc('match_notes', {
      query_embedding: note.embedding,
      match_threshold: matchThreshold,
      match_count: matchCount + 1, // +1 so we can exclude self below
      filter_user_id: note.user_id,
    });

    if (rpcError) {
      logger.error('RPC match_notes failed', rpcError as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch related notes' }, { status: 500 });
    }

    // 3) Filter out the current note and shape response
    type MatchRow = { id: number; similarity?: number } & Record<string, unknown>;
    const results = ((matches || []) as MatchRow[])
        .filter((m) => m.id !== Number(noteId))
      .slice(0, matchCount);

    const duration = Date.now() - start;
      logger.info('Related notes fetched', undefined, { noteId, matchCount: results.length, duration });
      logger.logResponse('GET', `/api/notes/${noteId}/suggestions`, 200, duration);

    return NextResponse.json({ results, count: results.length });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error in suggestions endpoint', error as Error);
    logger.logResponse('GET', '/api/notes/[id]/suggestions', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
