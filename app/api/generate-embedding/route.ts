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
        .maybeSingle();
      if (fetchErr || !note) {
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

    // Try write and attempt automatic padding on dimension mismatch
    // Convert array to PostgreSQL vector string format for pgvector
    const tryUpsert = async (vec: number[]) => {
      // Use proper pgvector string format: '[0.1,0.2,...]'
      const vectorString = `[${vec.join(',')}]`;
      const { error: upsertErr } = await supabase
        .from('notes')
        .update({ embedding: vectorString })
        .eq('id', noteId);
      return upsertErr;
    };

    let error = await tryUpsert(embedding);
    if (error) {
  const errObj = error as unknown as { message?: unknown };
  const msg = errObj && errObj.message ? String(errObj.message) : String(error);
      // If DB expects larger vector, pad and retry
      const m = msg.match(/expected\s*(\d+)/i);
      if (m && m[1]) {
        const expected = Number(m[1]);
        if (expected > embedding.length) {
          logger.warn('Padding embedding to match DB dimension', undefined, { noteId, got: embedding.length, expected });
          const padded = embedding.concat(new Array(expected - embedding.length).fill(0));
          error = await tryUpsert(padded);
        }
      }
    }

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
      // Forward the incoming Cookie header so the internal request runs with the same user context
      const cookieHeader = req.headers.get('cookie') || '';
      fetch(`${req.url.replace('/api/generate-embedding', `/api/notes/${noteId}/links`)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
        body: JSON.stringify({ auto_discover: true, min_similarity: 0.78 })
      }).catch(() => {});
    } catch {
      // noop - auto-linking should not block embeddings
    }

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
