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
    const id = Number(resolvedParams.id);
    if (!id || Number.isNaN(id)) {
      logger.warn('Invalid note id for suggested-tags');
      return NextResponse.json({ error: 'Invalid note id' }, { status: 400 });
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit') || 8);
    const limit = Math.max(1, Math.min(20, Number.isFinite(limitRaw) ? limitRaw : 8));
    const matchThresholdRaw = Number(url.searchParams.get('matchThreshold'));
    const matchThreshold = Number.isFinite(matchThresholdRaw)
      ? Math.max(0, Math.min(1, matchThresholdRaw))
      : 0.78;
    const matchCountRaw = Number(url.searchParams.get('matchCount'));
    const maxMatchCount = 50;
    const matchCount = Math.min(
      maxMatchCount,
      Math.max(limit + 1, Number.isFinite(matchCountRaw) ? matchCountRaw : 12)
    );

    const supabase = await getServerSupabase();

    // Ensure the user owns the note and get embedding + user_id
    const { data: note, error: noteErr } = await supabase
      .from('notes')
      .select('id, user_id, embedding')
      .eq('id', id)
      .single();

    if (noteErr || !note) {
      logger.warn('Note not found for suggested-tags', undefined, { supabaseError: noteErr || null });
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!note.embedding) {
      logger.info('Note has no embedding; returning empty suggested tags');
      return NextResponse.json({ suggestions: [], count: 0 });
    }

    // Get similar notes for this user
    const { data: matches, error: rpcErr } = await supabase.rpc('match_notes', {
      query_embedding: note.embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_user_id: note.user_id,
    });

    if (rpcErr) {
      logger.error('match_notes RPC failed (suggested-tags)', rpcErr as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch related notes' }, { status: 500 });
    }

  type MatchRow = { id: number; similarity?: number } & Record<string, unknown>;
  const similar = (Array.isArray(matches) ? (matches as MatchRow[]) : []).filter((m) => m.id !== id);
    if (similar.length === 0) {
      logger.info('No similar notes found for suggested-tags');
      return NextResponse.json({ suggestions: [], count: 0 });
    }

  const similarIds = similar.map((m) => m.id);

    // Fetch existing tags on current note to exclude them
    type TagRow = { tags: { id: number; name: string } | null };
    const { data: currentTags } = await supabase
      .from('note_tags')
      .select('tags ( id, name )')
      .eq('note_id', id);

    const currentTagNames = new Set(
      ((((currentTags || []) as unknown) as TagRow[])
        .map((nt) => nt?.tags?.name)
        .filter(Boolean) as string[])
        .map((n) => n.toLowerCase())
    );

    // Fetch tags from similar notes
    const { data: similarNoteTags, error: tagErr } = await supabase
      .from('note_tags')
      .select('note_id, tags ( id, name )')
      .in('note_id', similarIds);

    if (tagErr) {
      logger.error('Failed to fetch tags for similar notes', tagErr as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch tags for similar notes' }, { status: 500 });
    }

    // Build frequency map, excluding tags already on the current note
    const freq = new Map<string, { name: string; tag_id: number | null; count: number }>();
    for (const row of (((similarNoteTags || []) as unknown) as (TagRow & { note_id: number })[])) {
      const name: string | undefined = row?.tags?.name || undefined;
      const tag_id: number | undefined = row?.tags?.id || undefined;
      if (!name) continue;
      const lower = name.toLowerCase();
  if (currentTagNames.has(lower)) continue;
      const key = lower;
      const prev = freq.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        freq.set(key, { name, tag_id: tag_id ?? null, count: 1 });
      }
    }

    // Sort by count desc and take top N
    const suggestions = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(s => ({ name: s.name, tag_id: s.tag_id, score: s.count }));

  const duration = Date.now() - start;
  logger.info('Suggested tags generated', undefined, { id, count: suggestions.length, duration, matchThreshold, matchCount, limit });
  logger.logResponse('GET', `/api/notes/${id}/suggested-tags`, 200, duration);

    return NextResponse.json({ suggestions, count: suggestions.length });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error in suggested-tags endpoint', error as Error);
    // Use generic path; id may be invalid in this branch
      logger.logResponse('GET', `/api/notes/${resolvedParams?.id ?? '[id]'}/suggested-tags`, 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
