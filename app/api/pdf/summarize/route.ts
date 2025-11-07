import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';
import { getGroqSummary } from '@/lib/groq';

const MAX_CHUNK_SIZE = 8000; // Characters per chunk to stay within model limits

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
      logger.logResponse('POST', '/api/pdf/summarize', 401, Date.now() - startTime);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get PDF document ID from query params
    const { searchParams } = new URL(req.url);
    const pdfId = searchParams.get('id');

    if (!pdfId) {
      logger.logResponse('POST', '/api/pdf/summarize', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'PDF document ID is required' }, { status: 400 });
    }

    // Get optional parameters from request body
    const body = await req.json().catch(() => ({}));
    const persona = body.persona || 'default';
    const folderId = body.folder_id || null;
    const workspaceId = body.workspace_id || null;

    // Get PDF document from database
    const { data: pdfDoc, error: fetchError } = await supabase
      .from('pdf_documents')
      .select('*')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !pdfDoc) {
      logger.logResponse('POST', '/api/pdf/summarize', 404, Date.now() - startTime);
      return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
    }

    if (pdfDoc.status !== 'completed') {
      logger.logResponse('POST', '/api/pdf/summarize', 400, Date.now() - startTime);
      return NextResponse.json(
        { error: 'PDF has not been processed yet' },
        { status: 400 }
      );
    }

    if (!pdfDoc.full_text) {
      logger.logResponse('POST', '/api/pdf/summarize', 400, Date.now() - startTime);
      return NextResponse.json(
        { error: 'No text extracted from PDF' },
        { status: 400 }
      );
    }

    // Prepare text for summarization with page references
    const textWithPages = pdfDoc.pages
      .map((page: { page: number; text: string }) => {
        return `--- Page ${page.page} ---\n${page.text}`;
      })
      .join('\n\n');

    // If text is too long, chunk it intelligently
    let textToSummarize = textWithPages;
    let isChunked = false;

    if (textWithPages.length > MAX_CHUNK_SIZE) {
      isChunked = true;
      // For very long documents, summarize first and last pages plus a sample from the middle
      const firstPages = pdfDoc.pages.slice(0, 3);
      const middleIndex = Math.floor(pdfDoc.pages.length / 2);
      const middlePages = pdfDoc.pages.slice(middleIndex - 1, middleIndex + 2);
      const lastPages = pdfDoc.pages.slice(-3);

      textToSummarize = [
        ...firstPages,
        { page: '...', text: '[Content continues...]' },
        ...middlePages,
        { page: '...', text: '[Content continues...]' },
        ...lastPages,
      ]
        .map((page: { page: number | string; text: string }) => {
          return `--- Page ${page.page} ---\n${page.text}`;
        })
        .join('\n\n');
    }

    // Add document metadata to the text
    const documentContext = `
Document: ${pdfDoc.title || pdfDoc.original_filename}
${pdfDoc.author ? `Author: ${pdfDoc.author}` : ''}
Total Pages: ${pdfDoc.page_count}
${isChunked ? 'Note: This is a summary of selected pages from a longer document.' : ''}

--- Content ---
${textToSummarize}
`;

    // Call GROQ for summarization
  const summary = await getGroqSummary(documentContext, persona);

    // Create a note with the summary
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId || pdfDoc.workspace_id,
        folder_id: folderId || pdfDoc.folder_id,
        persona,
        original_notes: `PDF: ${pdfDoc.original_filename}`,
        summary: summary.summary,
        takeaways: summary.takeaways,
        actions: summary.actions,
        sentiment: summary.sentiment,
        pdf_document_id: pdfId,
      })
      .select()
      .single();

    if (noteError) {
      console.error('Failed to create note:', noteError);
      logger.logResponse('POST', '/api/pdf/summarize', 500, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Failed to create summary note' },
        { status: 500 }
      );
    }

    // Create page references for key pages
    const pageReferences = [];
    for (const takeaway of summary.takeaways.slice(0, 5)) {
      // Find which page(s) might contain this takeaway
      const matchingPages = pdfDoc.pages.filter((page: { text: string }) =>
        page.text.toLowerCase().includes(takeaway.toLowerCase().slice(0, 50))
      );

      if (matchingPages.length > 0) {
        const firstMatch = matchingPages[0];
        // Extract a snippet around the match
        const lowerText = firstMatch.text.toLowerCase();
        const searchPhrase = takeaway.toLowerCase().slice(0, 50);
        const matchIndex = lowerText.indexOf(searchPhrase);

        let snippet = '';
        if (matchIndex !== -1) {
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(firstMatch.text.length, matchIndex + 150);
          snippet = '...' + firstMatch.text.slice(start, end) + '...';
        }

        pageReferences.push({
          note_id: note.id,
          pdf_document_id: pdfId,
          page_number: firstMatch.page,
          snippet,
          quote: takeaway.slice(0, 500),
          position_in_note: pageReferences.length,
        });
      }
    }

    // Insert page references
    if (pageReferences.length > 0) {
      const { error: refError } = await supabase
        .from('pdf_page_references')
        .insert(pageReferences);

      if (refError) {
        console.error('Failed to create page references:', refError);
        // Don't fail the request, page references are optional
      }
    }

    // Handle tags
    if (summary.tags && summary.tags.length > 0) {
  const tagInserts = summary.tags.map((tag: string) => ({
        user_id: user.id,
        name: tag,
      }));

      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', summary.tags);

      const existingTagNames = new Set(
        existingTags?.map((t: { name: string }) => t.name) || []
      );
  const newTags = tagInserts.filter((t: { name: string }) => !existingTagNames.has(t.name));

      if (newTags.length > 0) {
        await supabase.from('tags').insert(newTags).select();
      }

      // Get all tag IDs
      const { data: allTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', summary.tags);

      if (allTags) {
        const noteTagInserts = allTags.map((tag: { id: string }) => ({
          note_id: note.id,
          tag_id: tag.id,
        }));

        await supabase.from('note_tags').insert(noteTagInserts);
      }
    }

    // Trigger embedding generation (fire and forget)
    const embeddingUrl = new URL('/api/generate-embedding', req.url);
    fetch(embeddingUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId: note.id }),
    }).catch((error) => {
      console.error('Failed to trigger embedding generation:', error);
    });

    logger.logResponse('POST', '/api/pdf/summarize', 200, Date.now() - startTime);
    return NextResponse.json({
      note_id: note.id,
      pdf_id: pdfId,
      summary: summary.summary,
      takeaways: summary.takeaways,
      actions: summary.actions,
      sentiment: summary.sentiment,
      tags: summary.tags,
      page_references: pageReferences.length,
    });
  } catch (error) {
    console.error('PDF summarization error:', error);
    logger.logResponse('POST', '/api/pdf/summarize', 500, Date.now() - startTime);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
