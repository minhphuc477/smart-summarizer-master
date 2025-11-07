import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const awaited = await params;
      logger.logResponse('GET', `/api/pdf/status/${awaited.id}`, 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const pdfId = (await params).id;
    const { data: doc, error } = await supabase
      .from('pdf_documents')
      .select('id,status,processing_error,full_text,page_count,summary_text')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single();

    if (error || !doc) {
      logger.logResponse('GET', `/api/pdf/status/${pdfId}`, 404, Date.now() - start);
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    logger.logResponse('GET', `/api/pdf/status/${pdfId}`, 200, Date.now() - start);
    return NextResponse.json({ pdf: doc });
  } catch (err: unknown) {
    const error = err as Error;
    const awaited = await params;
    logger.logResponse('GET', `/api/pdf/status/${awaited.id}`, 500, Date.now() - start);
    return NextResponse.json({ error: error?.message || 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
