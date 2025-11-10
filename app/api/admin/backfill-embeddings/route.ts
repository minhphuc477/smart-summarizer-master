import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

// Simple in-memory cache for the embedding pipeline instance
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as FeatureExtractionPipeline;
  }
  return embedder;
}

export async function POST(req: Request) {
  const logger = createRequestLogger(req);
  const supabase = await getServerSupabase();
  const start = Date.now();
  const url = new URL(req.url);

  const respond = (body: unknown, status = 200) => {
    const duration = Date.now() - start;
    logger.logResponse(req.method, url.pathname, status, duration);
    return NextResponse.json(body, { status });
  };

  try {
  const body = await req.json().catch(() => ({}));
  const { limit = 50, dryRun = false } = body || {};
  let user_id: string | undefined = body?.user_id;

    // Default to current authenticated user if user_id not provided
    if (!user_id) {
      const { data: authUser } = await supabase.auth.getUser();
      user_id = authUser?.user?.id;
    }
    if (!user_id) {
      logger.warn('Missing user_id in backfill request');
      return respond({ error: 'user_id required' }, 400);
    }

    // Authorization: ensure requester matches user_id or is admin (placeholder role check)
  // Allow a dev-only service-role header to authenticate local scripts without cookies.
  const serviceRoleHeader = req.headers.get('x-service-role') || req.headers.get('x-supabase-service-role');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let isServiceRole = false;
  if (serviceRoleHeader && serviceRoleKey && serviceRoleHeader === serviceRoleKey) {
    isServiceRole = true;
    logger.info('Authenticated backfill request via service-role header (dev only)');
  }

  const { data: authUser } = await supabase.auth.getUser();
  const requesterId = authUser?.user?.id;

    if (!requesterId && !isServiceRole) {
      logger.warn('Unauthorized: no auth user');
      return respond({ error: 'Not authenticated' }, 401);
    }

    if (!isServiceRole && requesterId !== user_id) {
      // Attempt role check from profiles/workspaces if available in schema
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', requesterId)
        .single();
      const role = (profile as { role?: string } | null)?.role;
      if (role !== 'admin') {
        logger.warn('Forbidden: requester not owner or admin', undefined, { requesterId, user_id });
        return respond({ error: 'Forbidden' }, 403);
      }
    }

    // Find notes lacking embeddings for this user
    const { data: missingNotes, error: missingError } = await supabase
      .from('notes')
      .select('id, original_notes, summary')
      .eq('user_id', user_id)
      .is('embedding', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (missingError) {
      logger.error('Error querying missing embeddings', missingError as Error);
      return respond({ error: 'Query failed' }, 500);
    }

    if (!missingNotes || missingNotes.length === 0) {
      logger.info('No notes need backfill');
      return respond({ message: 'All embeddings present', count: 0 });
    }

    logger.info('Backfill start', undefined, { count: missingNotes.length, dryRun });

    if (dryRun) {
      return respond({ message: 'Dry run', count: missingNotes.length, ids: missingNotes.map(n => n.id) });
    }

  const pipe = await getEmbedder();
    const results: { id: number; success: boolean; error?: string }[] = [];

    for (const note of missingNotes) {
      try {
        const text = (note.original_notes || '') + '\n' + (note.summary || '');
        const output = await pipe(text.substring(0, 5000), { pooling: 'mean' as const, normalize: true });
        const embedding = Array.from(output.data);

        // Try to write embedding. If DB rejects due to dimension mismatch (e.g. expects 1536),
        // attempt to parse expected dimension from the error message and pad the vector with zeros.
        const tryUpsert = async (vec: number[]) => {
          const { error: upsertError } = await supabase
            .from('notes')
            .update({ embedding: vec })
            .eq('id', note.id);
          return upsertError;
        };

        let upsertError = await tryUpsert(embedding);
        if (upsertError) {
          const upErrObj = upsertError as unknown as { message?: unknown };
          const msg = upErrObj && upErrObj.message ? String(upErrObj.message) : String(upsertError);

          // Look for 'expected <N>' pattern in error text
          const m = msg.match(/expected\s*(\d+)/i);
          if (m && m[1]) {
            const expected = Number(m[1]);
            if (expected > embedding.length) {
              logger.warn('Padding embedding to match DB dimension', undefined, { noteId: note.id, got: embedding.length, expected });
              const padded = embedding.concat(new Array(expected - embedding.length).fill(0));
              upsertError = await tryUpsert(padded);
            }
          }
        }

        if (upsertError) throw upsertError;
        results.push({ id: note.id, success: true });
      } catch (err) {
        const message = (err as Error)?.message || 'Unknown embedding error';
        logger.error('Embedding backfill error', err as Error, { noteId: note.id });
        results.push({ id: note.id, success: false, error: message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    logger.info('Backfill complete', undefined, { succeeded, failed: results.length - succeeded });

    return respond({
      message: 'Backfill finished',
      processed: results.length,
      succeeded,
      failed: results.length - succeeded,
      results,
    });
  } catch (error) {
    logger.error('Unhandled backfill error', error as Error);
    return respond({ error: 'Server error' }, 500);
  } finally {
    // response already logged via respond()
  }
}
