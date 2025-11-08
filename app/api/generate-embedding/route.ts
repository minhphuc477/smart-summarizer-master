import { NextResponse } from 'next/server';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSION } from '@/lib/embeddingsConfig';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

// Cache the embedding pipeline
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    // Load the model once and cache it
  embedder = (await pipeline('feature-extraction', EMBEDDING_MODEL)) as FeatureExtractionPipeline;
  }
  return embedder;
}

export async function POST(req: Request) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  try {
    const { noteId, text } = await req.json();
    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    // Ensure we have content to embed: prefer provided text, else fetch from DB
    let content: string | null = typeof text === 'string' && text.trim() ? text : null;

    const supabase = await getServerSupabase();
    if (!content) {
      const { data: note, error: fetchErr } = await supabase
        .from('notes')
        .select('original_notes, summary, takeaways')
        .eq('id', noteId)
        .single();
      if (fetchErr) {
        logger.error('Failed to load note for embedding', fetchErr as Error, { noteId });
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      const parts: string[] = [];
      if (note?.summary) parts.push(String(note.summary));
      if (Array.isArray(note?.takeaways)) parts.push((note.takeaways as string[]).join('\n'));
      if (note?.original_notes) parts.push(String(note.original_notes));
      content = parts.join('\n\n').trim().slice(0, 5000);
    } else {
      content = content.slice(0, 5000);
    }

    const pipe = await getEmbedder();
    await supabase.from('embedding_jobs')
      .upsert({ note_id: noteId, status: 'pending', attempts: 0 }, { onConflict: 'note_id' });
    const jobStart = Date.now();
    // mark processing
    await supabase.from('embedding_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('note_id', noteId);
    const output = await pipe(content, { pooling: 'mean' as const, normalize: true });
    const embedding = Array.from(output.data);

    // Runtime safeguard: dimension mismatch early hint before DB write
    if (embedding.length !== EMBEDDING_DIMENSION) {
      logger.warn('Embedding length differs from configured dimension', undefined, { got: embedding.length, expected: EMBEDDING_DIMENSION });
    }

    const { error } = await supabase
      .from('notes')
      .update({ embedding })
      .eq('id', noteId);

    if (error) {
      logger.error('Error updating embedding', error as Error, { noteId });
  const msg = error instanceof Error ? error.message : String(error);
  await supabase.from('embedding_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: msg }).eq('note_id', noteId);
      return NextResponse.json({ success: false, error: 'Failed to save embedding to database.' }, { status: 500 });
    }

    const durationMs = Date.now() - jobStart;
    await supabase.from('embedding_jobs').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('note_id', noteId);
  await supabase.from('embedding_metrics').insert({ note_id: noteId, duration_ms: durationMs, model_name: EMBEDDING_MODEL });

    // Fire-and-forget auto-linking
    try {
      fetch(`${req.url.replace('/api/generate-embedding', `/api/notes/${noteId}/links`)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_discover: true, min_similarity: 0.78 })
      }).catch(() => {});
    } catch {}

    logger.logResponse('POST', '/api/generate-embedding', 200, Date.now() - start, { noteId });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('dimension mismatch')) {
      logger.error('Dimension mismatch during embedding save', error as Error);
      return NextResponse.json({ success: false, error: `Dimension mismatch. DB column vector size differs from ${EMBEDDING_DIMENSION}. See lib/embeddingsConfig.ts for guidance.` }, { status: 500 });
    }
    logger.error('Error in /api/generate-embedding', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to generate embedding.' }, { status: 500 });
  }
}
