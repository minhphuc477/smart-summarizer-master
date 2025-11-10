import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ['application/pdf'];

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
      logger.logResponse('POST', '/api/pdf/upload', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspace_id') as string | null;
    const folderId = formData.get('folder_id') as string | null;

    if (!file) {
      logger.logResponse('POST', '/api/pdf/upload', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      logger.logResponse('POST', '/api/pdf/upload', 400, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logger.logResponse('POST', '/api/pdf/upload', 400, Date.now() - startTime);
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${user.id}/${fileName}`;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('pdf-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      logger.logResponse('POST', '/api/pdf/upload', 500, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Create database record with 'uploading' status initially
    const { data: pdfDoc, error: dbError } = await supabase
      .from('pdf_documents')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        folder_id: folderId,
        original_filename: file.name,
        file_size_bytes: file.size,
        storage_path: storagePath,
        status: 'uploading',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('pdf-documents').remove([storagePath]);
      logger.logResponse('POST', '/api/pdf/upload', 500, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Failed to create database record' },
        { status: 500 }
      );
    }

    // Immediately update to completed with mock extracted text
    // Note: Real implementation would use pdf-parse or similar library
    let extractedText = '';
    let pageCount = 0;
    
    try {
      // Download the PDF from storage to extract text
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('pdf-documents')
        .download(storagePath);
      
      if (!downloadError && pdfData) {
        // Convert blob to buffer
        const buffer = Buffer.from(await pdfData.arrayBuffer());

        try {
          // Dynamically import pdf-parse only when needed (server-side only)
          const { PDFParse } = await import('pdf-parse');
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          extractedText = textResult?.text || '';
          pageCount = textResult?.pages?.length || 0;
          console.log(`[PDF Upload] Extracted ${extractedText.length} characters from ${pageCount} pages`);
        } catch (impErr) {
          console.error('[PDF Upload] pdf-parse extract error:', impErr);
          extractedText = `[Failed to extract text from ${file.name}]`;
        }
      } else {
        console.error('[PDF Upload] Failed to download PDF for extraction:', downloadError);
        extractedText = `[Failed to extract text from ${file.name}]`;
      }
    } catch (extractError) {
      console.error('[PDF Upload] Text extraction error:', extractError);
      extractedText = `[Error extracting text from ${file.name}]`;
    }
    
    const { error: updateError } = await supabase
      .from('pdf_documents')
      .update({ 
        status: 'completed',
        full_text: extractedText,
        page_count: pageCount
      })
      .eq('id', pdfDoc.id);

    if (updateError) {
      console.error('Failed to update PDF status:', updateError);
    }

    // Add to processing queue - delete existing entry first to handle re-uploads
    await supabase
      .from('pdf_processing_queue')
      .delete()
      .eq('pdf_document_id', pdfDoc.id);

    const { error: queueError } = await supabase.from('pdf_processing_queue').insert({
      pdf_document_id: pdfDoc.id,
      user_id: user.id,
      status: 'pending',
      processing_options: {
        extract_text: true,
        extract_images: false,
        perform_ocr: false,
        generate_summary: true,
      },
    });

    if (queueError) {
      console.error('Queue insert error:', queueError);
      // Don't fail the request, but log the error
    }

    // Do not trigger heavy processing here. Client will call /api/pdf/request and background worker will call /api/pdf/process/:id
    logger.logResponse('POST', '/api/pdf/upload', 200, Date.now() - startTime);
    return NextResponse.json(
      {
        pdf: {
          id: pdfDoc.id,
          filename: pdfDoc.original_filename,
          size: pdfDoc.file_size_bytes,
          status: 'completed', // Return completed status
        },
        message: 'PDF uploaded successfully. Ready to summarize.'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PDF upload error:', error);
    logger.logResponse('POST', '/api/pdf/upload', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
