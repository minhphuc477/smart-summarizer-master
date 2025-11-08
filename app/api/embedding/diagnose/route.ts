import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSION, embeddingMismatchGuidance } from '@/lib/embeddingsConfig';
import { createRequestLogger } from '@/lib/logger';

export async function GET(req: Request) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  try {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('notes')
      .select('embedding')
      .not('embedding', 'is', null)
      .limit(1);

    if (error) {
      logger.error('Failed to sample embedding', error as Error);
      const errObj: unknown = error;
      const details = typeof errObj === 'object' && errObj !== null && 'message' in errObj
        ? String((errObj as { message: unknown }).message)
        : String(errObj);
      return NextResponse.json({ error: 'Failed to sample embedding', details }, { status: 500 });
    }

    let sampleDim: number | null = null;
    type Row = { embedding: number[] | null };
    const rows: Row[] = Array.isArray(data) ? (data as unknown as Row[]) : [];
    if (rows.length === 1 && Array.isArray(rows[0]?.embedding)) {
      sampleDim = (rows[0].embedding as number[]).length;
    }

    const mismatch = sampleDim !== null && sampleDim !== EMBEDDING_DIMENSION;

    const guidance = embeddingMismatchGuidance(sampleDim);
    const duration = Date.now() - start;
    logger.logResponse('GET', '/api/embedding/diagnose', 200, duration, { mismatch, sampleDim });
    return NextResponse.json({
      expected_model: EMBEDDING_MODEL,
      expected_dimension: EMBEDDING_DIMENSION,
      sample_db_dimension: sampleDim,
      mismatch,
      guidance,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('Embedding diagnose failed', err as Error);
    logger.logResponse('GET', '/api/embedding/diagnose', 500, duration);
    return NextResponse.json({ error: 'Unexpected error during diagnose' }, { status: 500 });
  }
}
