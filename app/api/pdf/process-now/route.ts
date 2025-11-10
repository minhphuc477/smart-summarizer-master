import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';
import { processPdfJob } from '@/lib/pdfJobs';

/**
 * Manual PDF processing endpoint - doesn't require CRON
 * Allows users to manually trigger PDF processing
 */
export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logger.logResponse('POST', '/api/pdf/process-now', 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pdfId = body?.pdf_id as string | undefined;
    
    if (!pdfId) {
      logger.logResponse('POST', '/api/pdf/process-now', 400, Date.now() - start);
      return NextResponse.json({ error: 'pdf_id is required' }, { status: 400 });
    }

    // Verify user owns this PDF
    const { data: pdf, error: pdfError } = await supabase
      .from('pdf_documents')
      .select('id, user_id, status')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single();

    if (pdfError || !pdf) {
      logger.logResponse('POST', '/api/pdf/process-now', 404, Date.now() - start);
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    // Process the PDF immediately (synchronously for now)
    await processPdfJob(pdfId);

    // Fetch updated status
    const { data: updated } = await supabase
      .from('pdf_documents')
      .select('*')
      .eq('id', pdfId)
      .single();

    logger.logResponse('POST', '/api/pdf/process-now', 200, Date.now() - start);
    return NextResponse.json({ 
      success: true, 
      pdf: updated,
      message: 'PDF processed successfully'
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('PDF processing error:', error);
    logger.logResponse('POST', '/api/pdf/process-now', 500, Date.now() - start);
    return NextResponse.json({ 
      error: error?.message || 'Processing failed',
      details: 'PDF text extraction is not yet fully implemented. This is a placeholder.'
    }, { status: 500 });
  }
}
