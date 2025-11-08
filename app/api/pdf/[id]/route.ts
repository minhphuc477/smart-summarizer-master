import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();

  try {
  const supabase = await getServerSupabase();
    const { id } = await params;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.logResponse('GET', `/api/pdf/${id}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get PDF document from database
    const { data: pdfDoc, error: fetchError } = await supabase
      .from('pdf_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !pdfDoc) {
      logger.logResponse('GET', `/api/pdf/${id}`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
    }

    // Get associated notes
    const { data: notes } = await supabase
      .from('notes')
      .select('id, summary, created_at')
      .eq('pdf_document_id', id)
      .order('created_at', { ascending: false });

    // Get page references
    const { data: pageRefs } = await supabase
      .from('pdf_page_references')
      .select('*')
      .eq('pdf_document_id', id)
      .order('page_number', { ascending: true });

    // Get public URL for the PDF file
    let publicUrl = null;
    if (pdfDoc.storage_path) {
      const { data } = supabase.storage
        .from('pdf-documents')
        .getPublicUrl(pdfDoc.storage_path);
      publicUrl = data.publicUrl;
    }

    logger.logResponse('GET', `/api/pdf/${id}`, 200, Date.now() - startTime);
    return NextResponse.json({
      id: pdfDoc.id,
      filename: pdfDoc.original_filename,
      title: pdfDoc.title,
      author: pdfDoc.author,
      size: pdfDoc.file_size_bytes,
      pageCount: pdfDoc.page_count,
      status: pdfDoc.status,
      errorMessage: pdfDoc.error_message,
      fullText: pdfDoc.full_text,
      pages: pdfDoc.pages,
      workspaceId: pdfDoc.workspace_id,
      folderId: pdfDoc.folder_id,
      publicUrl,
      notes: notes || [],
      pageReferences: pageRefs || [],
      createdAt: pdfDoc.created_at,
      updatedAt: pdfDoc.updated_at,
    });
  } catch (error) {
    console.error('PDF retrieval error:', error);
    const { id } = await params;
  logger.logResponse('GET', `/api/pdf/${id}`, 500, Date.now() - startTime);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE: remove a PDF document belonging to the current user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();
  const { id } = await params;

  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.logResponse('DELETE', `/api/pdf/${id}`, 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: pdfDoc, error: fetchError } = await supabase
      .from('pdf_documents')
      .select('id, storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (fetchError || !pdfDoc) {
      logger.logResponse('DELETE', `/api/pdf/${id}`, 404, Date.now() - startTime);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete DB row (cascade foreign keys if defined)
    const { error: deleteError } = await supabase
      .from('pdf_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (deleteError) {
      logger.logResponse('DELETE', `/api/pdf/${id}`, 500, Date.now() - startTime);
      return NextResponse.json({ error: 'Failed to delete PDF' }, { status: 500 });
    }

    // Best-effort storage deletion (ignore errors)
    if (pdfDoc.storage_path) {
      try {
        await supabase.storage.from('pdf-documents').remove([pdfDoc.storage_path]);
      } catch (e) {
        console.warn('Storage remove failed for PDF', id, e);
      }
    }

    logger.logResponse('DELETE', `/api/pdf/${id}`, 204, Date.now() - startTime);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('PDF delete error:', error);
    logger.logResponse('DELETE', `/api/pdf/${id}`, 500, Date.now() - startTime);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
