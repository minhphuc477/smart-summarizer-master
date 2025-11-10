import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
// Import transformers pipeline dynamically inside getEmbedder to avoid module-load
// failures crashing the Next server at startup (some environments may not have
// the native/wasm dependencies available during dev/test runs).
// We'll dynamically import when needed and cache the pipeline instance.
import { EMBEDDING_MODEL, EMBEDDING_DIMENSION } from '@/lib/embeddingsConfig';
import { createRequestLogger } from '@/lib/logger';
import { respondError } from '@/lib/apiErrors';

// Cache the embedding pipeline
let embedder: unknown = null;

async function getEmbedder() {
  if (embedder) return embedder;
  try {
  // Dynamically import to avoid import-time crashes
  const mod = await import('@xenova/transformers');
    if (!mod || typeof mod.pipeline !== 'function') {
      throw new Error('Transformers pipeline not available');
    }
    embedder = await mod.pipeline('feature-extraction', EMBEDDING_MODEL);
    return embedder;
  } catch (err) {
    // Bubble up so callers can return a helpful error instead of crashing the server
    throw new Error(`Failed to load embedding pipeline: ${(err as Error).message}`);
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  try {
  const { query, userId, folderId, matchCount = 5, matchThreshold = 0.78, filters, lexicalOnly = false } = await req.json();
    
    logger.debug('Search request received', { 
      query: query?.substring(0, 50), 
      userId, 
      matchCount, 
      matchThreshold 
    });

    if (!query || !query.trim()) {
      logger.warn('Missing search query');
      const { body, status } = respondError('INVALID_INPUT', 'Search query is required.', 400);
      return NextResponse.json(body, { status });
    }

    // If caller requests lexical-only, skip semantic and perform keyword search directly
    if (lexicalOnly) {
      const supabase = await getServerSupabase();
      try {
        const likePattern = `%${query.trim().replace(/%/g, '')}%`;
        const { data: lexical, error: lexErr } = await supabase
          .from('notes')
          .select('id, summary, original_notes, persona, created_at')
          .ilike('summary', likePattern)
          .limit(matchCount);
        if (lexErr) {
          logger.error('Lexical-only search failed', lexErr as Error);
          return NextResponse.json({ error: 'Lexical search failed.', code: 'LEXICAL_FAILED' }, { status: 500 });
        }
        const results = (lexical || []).map((r) => ({ ...r, similarity: 0 }));
        const totalDuration = Date.now() - startTime;
        logger.info('Lexical-only search completed', undefined, { count: results.length, totalDuration });
        logger.logResponse('POST', '/api/search', 200, totalDuration, { userId });
        return NextResponse.json({ results, query, count: results.length, mode: 'lexical' });
      } catch (lexOnlyCatch) {
        const totalDuration = Date.now() - startTime;
        logger.error('Error in lexical-only branch', lexOnlyCatch as Error);
        logger.logResponse('POST', '/api/search', 500, totalDuration);
        return NextResponse.json({ error: 'Lexical search failed.', code: 'LEXICAL_FAILED' }, { status: 500 });
      }
    }

    // 1. Build query embedding (local, cached model)
    const embeddingStart = Date.now();
    let pipe: unknown = null;
    try {
      pipe = await getEmbedder();
    } catch (embedErr) {
      // If the embedding pipeline can't be loaded, return a service-unavailable
      // response so the client can automatically fallback to lexical-only search.
      logger.error('Embedding pipeline unavailable', embedErr as Error, { userId });
      const totalDuration = Date.now() - startTime;
      logger.logResponse('POST', '/api/search', 503, totalDuration, { userId });
  // Return a specific error code so clients can detect and fallback to lexical-only search.
  const { body, status } = respondError('EMBEDDINGS_UNAVAILABLE', 'Embeddings are temporarily unavailable. Try keyword search (lexical-only).', 503);
      return NextResponse.json(body, { status });
    }
    // The dynamic pipeline has no static type here; cast to a callable shape we expect.
    const pipeFn = pipe as (input: string, opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>;
    const output = await pipeFn(query.trim(), {
      pooling: 'mean' as const,
      normalize: true,
    });

    const queryEmbedding = Array.from(output.data);
    if (queryEmbedding.length !== EMBEDDING_DIMENSION) {
      logger.warn('Query embedding dimension mismatch', undefined, { got: queryEmbedding.length, expected: EMBEDDING_DIMENSION });
    }
    const embeddingDuration = Date.now() - embeddingStart;
    
    logger.debug('Query embedding generated', undefined, { embeddingDuration });

  // 2. Primary semantic RPC call
    const searchStart = Date.now();
  const supabase = await getServerSupabase();
    const useFolderRpc = folderId !== null && folderId !== undefined;
    const procName = useFolderRpc ? 'match_notes_by_folder' : 'match_notes';
    const rpcArgs: Record<string, unknown> = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_user_id: userId || null,
    };
    if (useFolderRpc) rpcArgs.filter_folder_id = folderId;

    // Phase 1: attempt with requested threshold (slightly relaxed to avoid over-filtering)
    const adjustedThreshold = Math.min(matchThreshold, 0.75); // cap to 0.75 (empirically most notes cluster <0.8)
    const { data: dataPhase1, error: errorPhase1 } = await supabase.rpc(procName, { ...rpcArgs, match_threshold: adjustedThreshold });
    let results = (dataPhase1 || []);
  const searchDuration = Date.now() - searchStart;

  if (errorPhase1) {
      // Log the full error for debugging
      logger.error('Semantic search RPC failed', errorPhase1 as Error, { 
        procName, 
        userId, 
        folderId,
        embeddingDim: queryEmbedding.length,
        errorCode: (errorPhase1 as { code?: string }).code,
        errorDetails: (errorPhase1 as { details?: string }).details,
      });
      
      // Normalize error message without using 'any'
      const errObj: unknown = errorPhase1;
      const errMsg = typeof errObj === 'object' && errObj !== null && 'message' in errObj
        ? String((errObj as { message: unknown }).message)
        : String(errObj);
  if (errMsg.toLowerCase().includes('dimension mismatch') || /expected\s*\d+/i.test(errMsg)) {
  logger.warn('Semantic search RPC reported dimension mismatch — attempting to pad query embedding and retry', { procName, errMsg });
        // Try to extract expected dimension and retry RPC padded
        const m = errMsg.match(/expected\s*(\d+)/i);
        if (m && m[1]) {
          const expected = Number(m[1]);
          if (expected > queryEmbedding.length) {
            const padded = queryEmbedding.concat(new Array(expected - queryEmbedding.length).fill(0));
            try {
              const { data: retryData, error: retryErr } = await supabase.rpc(procName, { ...rpcArgs, query_embedding: padded, match_threshold: adjustedThreshold });
              if (!retryErr) {
                results = retryData || [];
              } else {
                logger.error('Retry RPC after padding failed', retryErr as Error, { procName });
                const guidance = `Semantic search failed due to dimension mismatch. Expected ${EMBEDDING_DIMENSION}. Adjust vector column or EMBEDDING_DIMENSION.`;
                return NextResponse.json({ error: guidance, code: 'SEMANTIC_DIMENSION_MISMATCH' }, { status: 500 });
              }
            } catch (retryCatch) {
              logger.error('Retry RPC after padding threw', retryCatch as Error, { procName });
              const guidance = `Semantic search failed due to dimension mismatch. Expected ${EMBEDDING_DIMENSION}. Adjust vector column or EMBEDDING_DIMENSION.`;
              return NextResponse.json({ error: guidance, code: 'SEMANTIC_DIMENSION_MISMATCH' }, { status: 500 });
            }
          }
        }
        // If we couldn't patch, return original guidance
        return NextResponse.json({ error: `Semantic search failed due to dimension mismatch. Expected ${EMBEDDING_DIMENSION}. Adjust vector column or EMBEDDING_DIMENSION.`, code: 'SEMANTIC_DIMENSION_MISMATCH' }, { status: 500 });
      }
      logger.error("Semantic search error (phase1)", errorPhase1 as Error, { userId, procName });
      return NextResponse.json({ error: 'Failed to search notes. Ensure semantic-search migration SQL ran.', code: 'SEMANTIC_RPC_FAILED' }, { status: 500 });
    }

    // Phase 2 fallback: broaden threshold to almost zero to get top similarities even if low
    let usedPhase2Fallback = false;
    if ((!results || results.length === 0) && adjustedThreshold > 0.01) {
      logger.info('No semantic hits (phase1); retrying with near-zero threshold', undefined, { previousThreshold: adjustedThreshold });
      // Use the requested matchCount rather than forcing 8; forcing can surface unrelated notes and confuse users
      const { data: dataPhase2, error: errorPhase2 } = await supabase.rpc(procName, { ...rpcArgs, match_threshold: 0.01, match_count: matchCount });
      if (!errorPhase2) {
        results = dataPhase2 || [];
        usedPhase2Fallback = true;
      } else {
        logger.warn('Phase2 semantic retry failed', undefined, { error: String(errorPhase2) });
      }
    }

    // Phase 3 lexical fallback: if still empty, run ILIKE search on summary/original_notes
    let usedLexicalFallback = false;
    if ((!results || results.length === 0) && query.trim().length >= 2) {
      logger.info('Semantic empty; performing lexical fallback');
      try {
        const likePattern = `%${query.trim().replace(/%/g, '')}%`;
        const { data: lexical, error: lexErr } = await supabase
          .from('notes')
          .select('id, summary, original_notes, persona, created_at')
          .ilike('summary', likePattern)
          .limit(matchCount);
        if (!lexErr && lexical && lexical.length > 0) {
          // Attach pseudo similarity (0) so client can still display deterministically
          results = lexical.map(r => ({ ...r, similarity: 0 }));
          usedLexicalFallback = true;
          logger.info('Lexical fallback produced results', undefined, { count: results.length });
        } else {
          logger.info('Lexical fallback produced no results');
        }
      } catch (_lexCatch) {
        logger.warn('Lexical fallback threw error');
      }
    }
    // Normalize similarity range if needed (ensure number)
  type RawResult = { id: number; summary?: string; original_notes?: string; persona?: string; created_at?: string; similarity?: number };
  results = (results as RawResult[]).map((r: RawResult) => ({ ...r, similarity: typeof r.similarity === 'number' ? r.similarity : 0 }));

    // Optional backfill: trigger embeddings for notes missing embeddings in the background
    if (userId) {
      try {
        const { data: missing } = await supabase
          .from('notes')
          .select('id')
          .eq('user_id', userId)
          .is('embedding', null)
          .limit(10);
        if (missing && missing.length > 0) {
          missing.forEach(({ id }) => {
            fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/generate-embedding`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ noteId: id }),
            }).catch(() => {});
          });
          logger.info('Triggered embedding backfill for missing notes', undefined, { count: missing.length });
        }
      } catch (_err) {
        logger.warn('Failed to trigger embedding backfill');
      }
    }

    // Apply advanced filters if provided
    const f = filters || {};
    const dateFrom = f.dateFrom ? new Date(f.dateFrom) : null;
    const dateTo = f.dateTo ? new Date(f.dateTo) : null;
    const sentiment: string | undefined = typeof f.sentiment === 'string' ? f.sentiment : undefined;
    const tags: string[] = Array.isArray(f.tags) ? f.tags : [];

    if (dateFrom || dateTo) {
      results = results.filter((r: { created_at?: string }) => {
        const t = new Date(r.created_at || Date.now());
        if (dateFrom && t < dateFrom) return false;
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (t > end) return false;
        }
        return true;
      });
    }

    if (sentiment && ['positive','neutral','negative'].includes(sentiment)) {
      results = results.filter((r: { sentiment?: string | null }) => (r.sentiment || null) === sentiment);
    }

  // Tag filtering (ANY match) — requires an additional lookup
    if (tags.length > 0 && results.length > 0) {
      const ids = results.map((r: { id: number }) => r.id);
      const { data: noteTags, error: tagErr } = await supabase
        .from('note_tags')
        .select('note_id, tags ( name )')
        .in('note_id', ids);
      if (!tagErr) {
        const byId = new Map<number, string[]>();
        type NoteTagRow = { note_id: number; tags: { name?: string } | null };
        const typedNoteTags = (noteTags ?? []) as NoteTagRow[];
        typedNoteTags.forEach((nt) => {
          const arr = byId.get(nt.note_id) || [];
          const nm = nt?.tags?.name ? String(nt.tags.name).toLowerCase() : '';
          if (nm) arr.push(nm);
          byId.set(nt.note_id, arr);
        });
        const target = new Set(tags.map((t: string) => t.toLowerCase()));
        results = results.filter((r: { id: number }) => {
          const have = new Set((byId.get(r.id) || []));
          for (const t of target) {
            if (have.has(t)) return true; // ANY match
          }
          return false;
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    // Enforce the requested matchCount server-side: some downstream RPCs may return more items
    // than requested; trim to the requested count to ensure consistent UI behavior.
    const finalResults = Array.isArray(results) ? results.slice(0, matchCount) : [];

    logger.info('Search completed successfully', undefined, { 
      requestedMatchCount: matchCount,
      resultsCount: finalResults.length,
      embeddingDuration,
      searchDuration,
      totalDuration,
      phases: {
        phase1Threshold: adjustedThreshold,
        usedPhase2Fallback,
        usedLexicalFallback
      }
    });
    
    logger.logResponse('POST', '/api/search', 200, totalDuration, { userId });

    return NextResponse.json({ 
      results: finalResults,
      query: query,
      count: finalResults.length,
      mode: usedLexicalFallback ? 'lexical' : 'semantic'
    });

  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    logger.error("Error in /api/search", error as Error);
    logger.logResponse('POST', '/api/search', 500, totalDuration);
    const { body, status } = respondError('INTERNAL', 'Failed to process search request.', 500);
    return NextResponse.json(body, { status });
  }
}
