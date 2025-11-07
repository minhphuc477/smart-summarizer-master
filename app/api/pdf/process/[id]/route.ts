import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { processPdfJob } from '@/lib/pdfJobs';

type Params = { params: Promise<{ id: string }> };

// Protected route invoked by a scheduled job or edge function (e.g. Vercel Cron)
export async function POST(req: NextRequest, { params }: Params) {
  const logger = createRequestLogger(req);
  const start = Date.now();
  try {
    const secret = req.headers.get('x-cron-secret');
    const awaited = await params;
    if (!secret || secret !== process.env.CRON_SECRET) {
      logger.logResponse('POST', `/api/pdf/process/${awaited.id}`, 401, Date.now() - start);
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const pdfId = awaited.id;
    await processPdfJob(pdfId);

    logger.logResponse('POST', `/api/pdf/process/${pdfId}`, 200, Date.now() - start);
    return NextResponse.json({ pdf_id: pdfId, processed: true });
  } catch (err: unknown) {
    const error = err as Error;
    const awaited = await params;
    logger.logResponse('POST', `/api/pdf/process/${awaited.id}`, 500, Date.now() - start);
    return NextResponse.json({ error: error?.message || 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}
