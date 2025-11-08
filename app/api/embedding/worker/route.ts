import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { createRequestLogger } from '@/lib/logger';

// Cache the embedding pipeline
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as FeatureExtractionPipeline;
  }
  return embedder;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export async function POST(req: Request) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  
  try {
    const { batchSize = 10 } = await req.json().catch(() => ({}));
    
    logger.info('Starting embedding worker batch', undefined, { batchSize });
    
    const supabase = await getServerSupabase();
    
    // Fetch pending jobs, prioritizing older ones and those with fewer attempts
    const { data: jobs, error: fetchError } = await supabase
      .from('embedding_jobs')
      .select('id, note_id, attempts')
      .in('status', ['pending', 'failed'])
      .order('attempts', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(batchSize);
    
    if (fetchError) {
      logger.error('Failed to fetch pending jobs', fetchError as Error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }
    
    if (!jobs || jobs.length === 0) {
      logger.info('No pending jobs found');
      return NextResponse.json({ message: 'No pending jobs', processed: 0 });
    }
    
    logger.info('Processing batch', undefined, { jobCount: jobs.length });
    
    const pipe = await getEmbedder();
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ noteId: number; error: string }>
    };
    
    for (const job of jobs) {
      // Check if this job has exceeded max retries
      if (job.attempts >= MAX_RETRIES) {
        logger.warn('Job exceeded max retries, skipping', undefined, { noteId: job.note_id, attempts: job.attempts });
        results.skipped++;
        continue;
      }
      
      // Calculate exponential backoff delay
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, job.attempts);
      if (job.attempts > 0) {
        logger.debug('Applying backoff', undefined, { noteId: job.note_id, backoffMs });
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
      
      try {
        // Mark as processing and increment attempts
        await supabase
          .from('embedding_jobs')
          .update({ 
            status: 'processing', 
            started_at: new Date().toISOString(),
            attempts: job.attempts + 1
          })
          .eq('id', job.id);
        
        // Fetch note content
        const { data: note, error: noteError } = await supabase
          .from('notes')
          .select('original_notes, summary, takeaways')
          .eq('id', job.note_id)
          .single();
        
        if (noteError || !note) {
          throw new Error(`Note not found: ${job.note_id}`);
        }
        
        // Build content to embed
        const parts: string[] = [];
        if (note?.summary) parts.push(String(note.summary));
        if (Array.isArray(note?.takeaways)) parts.push((note.takeaways as string[]).join('\n'));
        if (note?.original_notes) parts.push(String(note.original_notes));
        const content = parts.join('\n\n').trim().slice(0, 5000);
        
        if (!content) {
          throw new Error('No content to embed');
        }
        
        // Generate embedding
        const jobStart = Date.now();
        const output = await pipe(content, { pooling: 'mean' as const, normalize: true });
        const embedding = Array.from(output.data);
        const durationMs = Date.now() - jobStart;
        
        // Update note with embedding
        const { error: updateError } = await supabase
          .from('notes')
          .update({ embedding })
          .eq('id', job.note_id);
        
        if (updateError) {
          throw updateError;
        }
        
        // Mark job as completed and log metrics
        await supabase
          .from('embedding_jobs')
          .update({ 
            status: 'completed', 
            finished_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', job.id);
        
        await supabase
          .from('embedding_metrics')
          .insert({ 
            note_id: job.note_id, 
            duration_ms: durationMs, 
            model_name: 'Xenova/all-MiniLM-L6-v2' 
          });
        
        results.succeeded++;
        logger.debug('Job completed successfully', undefined, { noteId: job.note_id, durationMs });
        
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        logger.error('Job failed', error as Error, { noteId: job.note_id, attempt: job.attempts + 1 });
        
        // Mark as failed (will be retried if attempts < MAX_RETRIES)
        const status = (job.attempts + 1) >= MAX_RETRIES ? 'failed' : 'pending';
        await supabase
          .from('embedding_jobs')
          .update({ 
            status,
            finished_at: status === 'failed' ? new Date().toISOString() : null,
            error_message: errorMsg
          })
          .eq('id', job.id);
        
        results.failed++;
        results.errors.push({ noteId: job.note_id, error: errorMsg });
      }
      
      results.processed++;
    }
    
    const totalDuration = Date.now() - start;
    logger.info('Batch processing completed', undefined, { 
      ...results, 
      totalDuration 
    });
    
    logger.logResponse('POST', '/api/embedding/worker', 200, totalDuration);
    
    return NextResponse.json({
      success: true,
      ...results,
      duration_ms: totalDuration
    });
    
  } catch (error: unknown) {
    const totalDuration = Date.now() - start;
    logger.error('Worker batch failed', error as Error);
    logger.logResponse('POST', '/api/embedding/worker', 500, totalDuration);
    return NextResponse.json({ 
      success: false, 
      error: 'Worker batch failed' 
    }, { status: 500 });
  }
}
