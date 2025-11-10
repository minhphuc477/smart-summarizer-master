import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

// Next.js 15 type expectation for dynamic segment handlers requires the second arg's params to be a Promise
// in generated .next types (ParamCheck<RouteContext>). Align with other route files in the project.
type IdParams = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: IdParams }) {
  const { id } = await params;
  const logger = createRequestLogger(_req);
  const supabase = await getServerSupabase();
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const { data: job } = await supabase
    .from('embedding_jobs')
    .select('status, started_at, finished_at, error_message')
    .eq('note_id', idNum)
    .single();
  logger.logResponse('GET', '/api/embedding/status/[id]', 200, 0);
  return NextResponse.json({
    status: job?.status || 'missing',
    started_at: job?.started_at || null,
    finished_at: job?.finished_at || null,
    error_message: job?.error_message || null,
  });
}

export async function HEAD(_req: NextRequest, { params }: { params: IdParams }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) return new NextResponse(null, { status: 400 });
  const { data: job } = await supabase
    .from('embedding_jobs')
    .select('status')
    .eq('note_id', idNum)
    .single();
  const map: Record<string, number> = {
    completed: 204,
    processing: 102, // Processing
    pending: 102,
    failed: 424, // Failed Dependency
  };
  const status = job?.status || 'missing';
  const code = status in map ? map[status] : 404;
  return new NextResponse(null, { status: code, headers: { 'x-embedding-status': status } });
}
