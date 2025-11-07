import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';
import { enqueuePdfJob } from '@/lib/pdfJobs';

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.logResponse('POST', '/api/pdf/request', 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pdfId = body?.pdf_id as string | undefined;
    if (!pdfId) {
      logger.logResponse('POST', '/api/pdf/request', 400, Date.now() - start);
      return NextResponse.json({ error: 'pdf_id is required', code: 'INVALID_INPUT' }, { status: 400 });
    }

    // Update doc status and enqueue
    await supabase
      .from('pdf_documents')
      .update({ status: 'pending' })
      .eq('id', pdfId)
      .eq('user_id', user.id);

    await enqueuePdfJob(pdfId, user.id, true);

    logger.logResponse('POST', '/api/pdf/request', 202, Date.now() - start);
    return NextResponse.json({ pdf_id: pdfId, status: 'pending' }, { status: 202 });
  } catch (err: unknown) {
    const error = err as Error;
    logger.logResponse('POST', '/api/pdf/request', 500, Date.now() - start);
    return NextResponse.json({ error: error?.message || 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
