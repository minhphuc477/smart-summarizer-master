import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { getServerSupabase } from '@/lib/supabaseServer';
import { getGroqSummary } from '@/lib/groq';

const MAX_CHUNK_SIZE = 8000; // Characters per chunk to stay within model limits

// Helper function to calculate word overlap similarity between two texts
function calculateWordOverlapSimilarity(text1: string, text2: string): number {
  // Normalize texts: lowercase, remove punctuation, split into words
  const normalize = (text: string) => 
    text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2); // Filter out very short words

  const words1 = normalize(text1);
  const words2 = normalize(text2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Create sets for faster lookup
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  // Calculate intersection
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  
  // Calculate Jaccard similarity: |intersection| / |union|
  const union = new Set([...set1, ...set2]);
  const similarity = intersection.size / union.size;
  
  return similarity;
}

// Helper function to find best matching pages for a takeaway
function findMatchingPages(takeaway: string, pages: Array<{ page: number; text: string }>, minSimilarity = 0.1) {
  const matches = [];
  
  for (const page of pages) {
    const similarity = calculateWordOverlapSimilarity(takeaway, page.text);
    if (similarity >= minSimilarity) {
      matches.push({ page, similarity });
    }
  }
  
  // Sort by similarity (highest first) and return top matches
  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

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

    // Prepare text for summarization
    let textToSummarize = pdfDoc.full_text;
    let isChunked = false;

    // If PDF has page-by-page data, use it for better context
    if (pdfDoc.pages && Array.isArray(pdfDoc.pages) && pdfDoc.pages.length > 0) {
      const textWithPages = pdfDoc.pages
        .map((page: { page: number; text: string }) => {
          return `--- Page ${page.page} ---\n${page.text}`;
        })
        .join('\n\n');

      // If text is too long, chunk it intelligently
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
      } else {
        textToSummarize = textWithPages;
      }
    } else {
      // No page data, just use full_text and chunk if needed
      if (pdfDoc.full_text.length > MAX_CHUNK_SIZE) {
        isChunked = true;
        // Take first and last portions of text
        const chunkSize = Math.floor(MAX_CHUNK_SIZE / 3);
        const start = pdfDoc.full_text.substring(0, chunkSize);
        const middle = pdfDoc.full_text.substring(
          Math.floor(pdfDoc.full_text.length / 2) - Math.floor(chunkSize / 2),
          Math.floor(pdfDoc.full_text.length / 2) + Math.floor(chunkSize / 2)
        );
        const end = pdfDoc.full_text.substring(pdfDoc.full_text.length - chunkSize);
        textToSummarize = `${start}\n\n[...content continues...]\n\n${middle}\n\n[...content continues...]\n\n${end}`;
      }
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

    if (noteError || !note) {
      console.error('Failed to create note:', noteError);
      logger.logResponse('POST', '/api/pdf/summarize', 500, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Failed to create summary note' },
        { status: 500 }
      );
    }

    console.log('[PDF Summarize] Created note:', note.id);

    // Create page references for key pages (only if page data exists)
    const pageReferences = [];
    if (pdfDoc.pages && Array.isArray(pdfDoc.pages) && pdfDoc.pages.length > 0) {
      for (const takeaway of summary.takeaways.slice(0, 5)) {
        // Find best matching pages using word overlap similarity
        const matchingPages = findMatchingPages(takeaway, pdfDoc.pages, 0.1); // Minimum 10% word overlap

        if (matchingPages.length > 0) {
          const bestMatch = matchingPages[0];
          const page = bestMatch.page;
          
          // Extract a snippet around the most relevant part of the page
          // Look for the section of the page text that has highest word overlap with the takeaway
          const takeawayWords = takeaway.toLowerCase().split(/\s+/).filter(word => word.length > 2);
          let bestSnippetStart = 0;
          let bestOverlap = 0;
          
          // Slide a window through the page text to find the best matching section
          const words = page.text.toLowerCase().split(/\s+/);
          const windowSize = Math.min(50, words.length); // Look at windows of ~50 words
          
          for (let i = 0; i <= words.length - windowSize; i++) {
            const windowWords = words.slice(i, i + windowSize);
            const overlap = windowWords.filter(word => 
              takeawayWords.some(takeawayWord => word.includes(takeawayWord) || takeawayWord.includes(word))
            ).length;
            
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestSnippetStart = i;
            }
          }
          
          // Extract snippet around the best matching section
          const snippetStart = Math.max(0, bestSnippetStart - 10);
          const snippetEnd = Math.min(words.length, bestSnippetStart + windowSize + 10);
          const snippet = '...' + words.slice(snippetStart, snippetEnd).join(' ') + '...';

          pageReferences.push({
            note_id: note.id,
            pdf_document_id: pdfId,
            page_number: page.page,
            snippet,
            quote: takeaway.slice(0, 500),
            position_in_note: pageReferences.length,
          });
        }
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

    // Trigger embedding generation (fire and forget) with text content to avoid auth issues
    const embeddingUrl = new URL('/api/generate-embedding', req.url);
    const embeddingText = [
      summary.summary,
      ...(summary.takeaways || []),
      `PDF: ${pdfDoc.original_filename}`
    ].join('\n\n').slice(0, 5000);
    
    // Forward the incoming Cookie header so the embedding trigger runs with the same user context
    const cookieHeader = (req.headers.get?.('cookie') || '');

    // Fire-and-forget with retries and logging to help diagnose timing/auth issues.
    const attemptAutoLink = async () => {
      const maxAttempts = 3;
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const resp = await fetch(embeddingUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
            body: JSON.stringify({ noteId: note.id, text: embeddingText }),
          });

          // Try to capture a small portion of the response body for debugging
          let respText: string | null = null;
          try {
            respText = await resp.text();
          } catch {
            respText = null;
          }

          const truncated = typeof respText === 'string' ? (respText.length > 300 ? respText.slice(0, 300) + '...' : respText) : null;
          console.log(`[PDF Summarize] embedding-trigger attempt=${attempt} status=${resp.status} noteId=${note.id} body=${truncated}`);

          if (resp.ok) {
            // Success, stop retrying
            return;
          }

          lastError = new Error(`Non-OK status ${resp.status}`);
        } catch (err) {
          console.error(`[PDF Summarize] embedding-trigger attempt=${attempt} failed for noteId=${note.id}`, err);
          lastError = err;
        }

        // Exponential backoff before next attempt
        const backoffMs = 200 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }

      console.error('[PDF Summarize] embedding-trigger final error', lastError, { noteId: note.id });
    };

    // Kick off the attempts shortly after returning the response (fire-and-forget)
    setTimeout(() => {
      attemptAutoLink().catch((e) => console.error('[PDF Summarize] attemptAutoLink unexpected error', e));
    }, 250);

    logger.logResponse('POST', '/api/pdf/summarize', 200, Date.now() - startTime);
    // Return the created note object for client convenience while keeping
    // `note_id` for backward compatibility with older clients.
    return NextResponse.json({
      success: true,
      note_id: note.id,
      note,
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
