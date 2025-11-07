import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const logger = createRequestLogger(req);
  const started = Date.now();
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok' as 'ok' | 'degraded' | 'error',
    database: 'unknown' as 'ok' | 'error' | 'unknown',
    groq: 'unknown' as 'configured' | 'missing' | 'unknown',
    version: process.env.npm_package_version || 'unknown',
    latency_ms: 0 as number
  };

  try {
    // Check database connection
  const supabase = await getServerSupabase();
    const { error: dbError } = await supabase
      .from('notes')
      .select('id', { head: true, count: 'exact' });
    
    checks.database = dbError ? 'error' : 'ok';

    // Check GROQ API key configuration
    const groqKey = process.env.GROQ_API_KEY;
    checks.groq = groqKey ? 'configured' : 'missing';

    // Determine overall status
    const allOk = checks.database === 'ok' && checks.groq === 'configured';
    checks.status = allOk ? 'ok' : 'degraded';
    checks.latency_ms = Date.now() - started;

    logger.logResponse('GET', '/api/health', allOk ? 200 : 503, checks.latency_ms);
    return NextResponse.json(checks, { 
      status: allOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (error) {
    const latency = Date.now() - started;
    logger.error('Health check failed', error as Error);
    logger.logResponse('GET', '/api/health', 500, latency);
    return NextResponse.json({
      ...checks,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}
