import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { createRequestLogger } from '@/lib/logger';
import { respondError } from '@/lib/apiErrors';

// Cache the embedding pipeline
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as FeatureExtractionPipeline;
  }
  return embedder;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  try {
  const { query, userId, folderId, matchCount = 5, matchThreshold = 0.78, filters } = await req.json();
    
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

    // 1. Tạo embedding cho câu truy vấn bằng Transformers.js (local, free)
    const embeddingStart = Date.now();
    const pipe = await getEmbedder();
    const output = await pipe(query.trim(), {
      pooling: 'mean' as const,
      normalize: true,
    });

    const queryEmbedding = Array.from(output.data);
    const embeddingDuration = Date.now() - embeddingStart;
    
    logger.debug('Query embedding generated', undefined, { embeddingDuration });

    // 2. Gọi RPC function trên Supabase để tìm các ghi chú tương tự
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

  const { data, error } = await supabase.rpc(procName, rpcArgs);
    const searchDuration = Date.now() - searchStart;

    if (error) {
      logger.error("Semantic search error", error as Error, { userId, procName });
      const { body, status } = respondError('INTERNAL', "Failed to search notes. Make sure you've run the semantic-search migration SQL.", 500);
      return NextResponse.json(body, { status });
    }

    // Results from RPC (already folder-filtered when applicable)
    let results = (data || []);

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
    logger.info('Search completed successfully', undefined, { 
      resultsCount: results?.length || 0,
      embeddingDuration,
      searchDuration,
      totalDuration
    });
    
    logger.logResponse('POST', '/api/search', 200, totalDuration, { userId });

    return NextResponse.json({ 
      results,
      query: query,
      count: results.length 
    });

  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    logger.error("Error in /api/search", error as Error);
    logger.logResponse('POST', '/api/search', 500, totalDuration);
    const { body, status } = respondError('INTERNAL', 'Failed to process search request.', 500);
    return NextResponse.json(body, { status });
  }
}
