import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function GET(req: Request) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  
  try {
    const supabase = await getServerSupabase();
    
    // Get aggregated metrics
    const { data: metrics, error } = await supabase
      .from('embedding_metrics')
      .select('duration_ms, model_name, created_at');
    
    if (error) {
      logger.error('Failed to fetch metrics', error as Error);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }
    
    if (!metrics || metrics.length === 0) {
      return NextResponse.json({
        total_embeddings: 0,
        by_model: [],
        overall: {
          count: 0,
          avg_duration_ms: 0,
          min_duration_ms: 0,
          max_duration_ms: 0,
          p50_duration_ms: 0,
          p95_duration_ms: 0,
          p99_duration_ms: 0
        },
        job_status: {},
        generated_at: new Date().toISOString()
      });
    }
    
    // Group by model
    const byModel = metrics.reduce((acc, m) => {
      const model = m.model_name || 'unknown';
      if (!acc[model]) {
        acc[model] = [];
      }
      acc[model].push(m.duration_ms);
      return acc;
    }, {} as Record<string, number[]>);
    
    // Calculate percentile
    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };
    
    // Calculate stats by model
    const modelStats = Object.entries(byModel).map(([model, durations]) => {
      const sum = durations.reduce((a, b) => a + b, 0);
      return {
        model,
        count: durations.length,
        avg_duration_ms: Math.round(sum / durations.length),
        min_duration_ms: Math.min(...durations),
        max_duration_ms: Math.max(...durations),
        p50_duration_ms: percentile(durations, 50),
        p95_duration_ms: percentile(durations, 95),
        p99_duration_ms: percentile(durations, 99)
      };
    });
    
    // Overall stats
    const allDurations = metrics.map(m => m.duration_ms);
    const totalSum = allDurations.reduce((a, b) => a + b, 0);
    
    const overall = {
      count: metrics.length,
      avg_duration_ms: Math.round(totalSum / metrics.length),
      min_duration_ms: Math.min(...allDurations),
      max_duration_ms: Math.max(...allDurations),
      p50_duration_ms: percentile(allDurations, 50),
      p95_duration_ms: percentile(allDurations, 95),
      p99_duration_ms: percentile(allDurations, 99)
    };
    
    // Get job status counts
    const { data: jobs } = await supabase
      .from('embedding_jobs')
      .select('status');
    
    const statusCounts = (jobs || []).reduce((acc, j) => {
      const status = j.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const duration = Date.now() - start;
    logger.logResponse('GET', '/api/embedding/metrics', 200, duration);
    
    return NextResponse.json({
      total_embeddings: metrics.length,
      by_model: modelStats,
      overall,
      job_status: statusCounts,
      generated_at: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Metrics request failed', error as Error);
    logger.logResponse('GET', '/api/embedding/metrics', 500, duration);
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
  }
}
