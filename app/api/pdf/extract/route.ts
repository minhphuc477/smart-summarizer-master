import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';
import { PDFParse } from 'pdf-parse';

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
  const supabase = await getServerSupabase();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('POST', '/api/pdf/extract', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get PDF document ID from query params
    const { searchParams } = new URL(req.url);
    const pdfId = searchParams.get('id');

    if (!pdfId) {
      logger.logResponse('POST', '/api/pdf/extract', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'PDF document ID is required' }, { status: 400 });
    }

    // Get PDF document from database
    const { data: pdfDoc, error: fetchError } = await supabase
      .from('pdf_documents')
      .select('*')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !pdfDoc) {
      logger.logResponse('POST', '/api/pdf/extract', 404, Date.now() - startTime);
      return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
    }

    // Update queue status to processing
    await supabase
      .from('pdf_processing_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('pdf_document_id', pdfId);

    try {
      // Download PDF from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('pdf-documents')
        .download(pdfDoc.storage_path);

      if (downloadError || !fileData) {
        throw new Error('Failed to download PDF from storage');
      }

      // Convert blob to buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text from PDF
        // Extract text from PDF using PDFParse
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
      
        // Get page count (need to parse again for metadata)
        const infoResult = await parser.getInfo();
        const pdfData = {
          text: textResult.text,
          numpages: textResult.pages.length,
          info: infoResult.metadata,
        };

      // Extract text by page
      const pages: Array<{ page: number; text: string; wordCount: number }> = [];
      let fullText = '';

      // Split by page breaks (this is approximate as pdf-parse doesn't give precise page breaks)
      // For better page-by-page extraction, consider using pdf.js or pdfjs-dist
      const textLines = pdfData.text.split('\n');
      const estimatedLinesPerPage = Math.ceil(textLines.length / pdfData.numpages);

      for (let i = 0; i < pdfData.numpages; i++) {
        const startLine = i * estimatedLinesPerPage;
        const endLine = Math.min((i + 1) * estimatedLinesPerPage, textLines.length);
        const pageText = textLines.slice(startLine, endLine).join('\n');
    const wordCount = pageText.split(/\s+/).filter((w: string) => w.length > 0).length;

        pages.push({
          page: i + 1,
          text: pageText,
          wordCount,
        });

        fullText += pageText + '\n';
      }

      // Extract metadata
      const metadata: Record<string, string | null> = {
        title: pdfDoc.original_filename,
        author: null,
        subject: null,
        keywords: null,
        creator: null,
        producer: null,
        creationDate: null,
        modDate: null,
      };

      // Try to extract metadata if available
      if (pdfData.info && typeof pdfData.info.get === 'function') {
        try {
          metadata.title = pdfData.info.get('dc:title') || pdfData.info.get('Title') || metadata.title;
          metadata.author = pdfData.info.get('dc:creator') || pdfData.info.get('Author') || null;
          metadata.subject = pdfData.info.get('dc:subject') || pdfData.info.get('Subject') || null;
          metadata.keywords = pdfData.info.get('pdf:Keywords') || pdfData.info.get('Keywords') || null;
          metadata.creator = pdfData.info.get('xmp:CreatorTool') || pdfData.info.get('Creator') || null;
          metadata.producer = pdfData.info.get('pdf:Producer') || pdfData.info.get('Producer') || null;
        } catch (e) {
          console.warn('Failed to extract PDF metadata:', e);
        }
      }

      // Update database with extracted data
      const { error: updateError } = await supabase
        .from('pdf_documents')
        .update({
          status: 'completed',
          full_text: fullText.trim(),
          pages,
          page_count: pdfData.numpages,
          title: metadata.title,
          author: metadata.author,
          extraction_method: 'pdf-parse',
          processing_duration_ms: Date.now() - startTime,
        })
        .eq('id', pdfId);

      if (updateError) {
        throw new Error('Failed to update database with extracted data');
      }

      // Update queue status to completed
      await supabase
        .from('pdf_processing_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('pdf_document_id', pdfId);

      logger.logResponse('POST', '/api/pdf/extract', 200, Date.now() - startTime);
      return NextResponse.json({
        id: pdfId,
        status: 'completed',
        pageCount: pdfData.numpages,
        metadata,
      });
    } catch (processingError) {
      console.error('PDF processing error:', processingError);

      // Update document status to failed
      await supabase
        .from('pdf_documents')
        .update({
          status: 'failed',
          error_message:
            processingError instanceof Error
              ? processingError.message
              : 'Unknown processing error',
        })
        .eq('id', pdfId);

      // Update queue status to failed and increment attempts
      const { data: queueItem } = await supabase
        .from('pdf_processing_queue')
        .select('attempts, max_attempts')
        .eq('pdf_document_id', pdfId)
        .single();

      if (queueItem) {
        const newAttempts = (queueItem.attempts || 0) + 1;
        await supabase
          .from('pdf_processing_queue')
          .update({
            status: newAttempts >= queueItem.max_attempts ? 'failed' : 'pending',
            attempts: newAttempts,
            error_message:
              processingError instanceof Error
                ? processingError.message
                : 'Unknown processing error',
          })
          .eq('pdf_document_id', pdfId);
      }

      throw processingError;
    }
  } catch (error) {
    console.error('PDF extraction error:', error);
    logger.logResponse('POST', '/api/pdf/extract', 500, Date.now() - startTime);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
