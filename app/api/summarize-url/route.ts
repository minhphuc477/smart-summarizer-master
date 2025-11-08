import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { getGroqSummary } from '@/lib/groq'; // Reuse summarization with safeguards
import { createRequestLogger } from '@/lib/logger';

// Soft limits to avoid 413 errors. Actual token guard handled inside getGroqSummary.
const MAX_CONTENT_CHARS = 24000; // mirrors HARD_CHAR_LIMIT in groq.ts
const MIN_VALID_CONTENT_CHARS = 200; // reject ultra-short pages

// Helper to extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Fetch YouTube transcript using youtube-transcript package
async function getYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // Use youtube-transcript npm package
    const { YoutubeTranscript } = await import('youtube-transcript');
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript available');
    }

    // Combine all transcript segments
    return transcript.map((item: { text: string }) => item.text).join(' ');
  } catch (error) {
    throw new Error(`Failed to fetch YouTube transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(req: Request) {
  const logger = createRequestLogger(req);
  const start = Date.now();

  try {
    const { url, customPersona } = await req.json();
    if (!url) {
      logger.warn('URL is required');
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    logger.info('URL summarization requested', undefined, { url: url.slice(0, 100) });

  let content = '';
  let usedYouTubeMetadataFallback = false;
  let contentSource: 'youtube-transcript' | 'youtube-metadata' | 'webpage' = 'webpage';

    // Check if it's a YouTube URL
    const youtubeVideoId = extractYouTubeVideoId(url);
    
    if (youtubeVideoId) {
      logger.info('YouTube video detected', undefined, { videoId: youtubeVideoId });
      try {
        // Forced transcript behaviors via special query params (usable in tests or debugging)
        if (url.includes('__forceTranscriptSuccess')) {
          content = 'Forced transcript content for testing.';
          contentSource = 'youtube-transcript';
          logger.info('Forced transcript success param detected');
        } else if (url.includes('__forceTranscriptError')) {
          throw new Error('Forced transcript error param detected');
        }
        if (!content) {
          content = await getYouTubeTranscript(youtubeVideoId);
          logger.info('YouTube transcript fetched', undefined, { length: content.length });
          contentSource = 'youtube-transcript';
        }
      } catch (error) {
        logger.error('YouTube transcript fetch failed', error as Error);
        // Fallback: attempt to fetch basic video metadata via oEmbed as minimal context
        try {
          const oembedResp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeVideoId}&format=json`);
          if (oembedResp.ok) {
            const meta = await oembedResp.json();
            const title = meta?.title || 'Untitled Video';
            const author = meta?.author_name ? ` by ${meta.author_name}` : '';

            // Try to fetch the video's public page to extract the description (og:description)
            // This often contains richer context even when transcripts are unavailable.
            let description = '';
            try {
              const pageResp = await fetch(`https://www.youtube.com/watch?v=${youtubeVideoId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
              });
              if (pageResp.ok) {
                const html = await pageResp.text();
                try {
                  const dom = new JSDOM(html);
                  const doc = dom.window.document;
                  const og = doc.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
                  const nameDesc = doc.querySelector('meta[name="description"]') as HTMLMetaElement | null;
                  description = (og?.getAttribute('content') || nameDesc?.getAttribute('content') || '').trim();
                  if (description) {
                    logger.info('Enriched YouTube fallback with page description', undefined, { descLength: description.length });
                  }
                } catch (_e) {
                  // parsing failed — ignore and continue with oEmbed title only
                }
              }
            } catch (_pageErr) {
              // network failed — ignore and continue with oEmbed title only
            }

            content = `Video Title: ${title}${author}.` + (description ? ` Description: ${description}` : '');
            content += ' Transcript unavailable. Provide a summary focusing on probable educational or conceptual themes based on the title and description.';
            usedYouTubeMetadataFallback = true;
            contentSource = 'youtube-metadata';
            logger.info('YouTube metadata fallback used', undefined, { contentLength: content.length });
          } else {
            return NextResponse.json({
              error: 'No transcript available and metadata fetch failed. Try a different video with captions enabled.'
            }, { status: 400 });
          }
  } catch (_metaErr) {
          logger.warn('YouTube metadata fallback failed');
          return NextResponse.json({
            error: 'Could not fetch transcript or metadata. Video may not have captions.'
          }, { status: 400 });
        }
      }
    } else {
      // Regular web page extraction
      logger.info('Fetching web page content');
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        logger.warn('Failed to fetch URL', undefined, { status: response.status });
        return NextResponse.json({ error: `Failed to fetch URL (${response.status})` }, { status: 400 });
      }

      const html = await response.text();

      // Use JSDOM and Readability to extract main content
      const doc = new JSDOM(html, { url });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      if (!article || !article.textContent) {
        logger.warn('Could not extract content from URL');
        return NextResponse.json({ error: "Could not extract content from the URL." }, { status: 400 });
      }
      
      content = article.textContent || '';
      contentSource = 'webpage';
    }

    // Sanitize and validate content
    content = content.replace(/\s+/g, ' ').trim();
    
    // If we fell back to minimal YouTube metadata (title/author), allow proceeding
    // even if the extracted content is short. This gives the user a best-effort
    // summary instead of a hard 400 when transcripts are unavailable.
    // If we explicitly used the YouTube oEmbed metadata fallback, allow proceeding
    // even if the extracted content is short. This produces a best-effort summary
    // instead of a hard 400 when transcripts are unavailable.
    if (content.length < MIN_VALID_CONTENT_CHARS && !usedYouTubeMetadataFallback) {
      logger.warn('Extracted content too short', undefined, { length: content.length });
      return NextResponse.json({ error: "Extracted content too short to summarize." }, { status: 400 });
    }
    
    if (content.length > MAX_CONTENT_CHARS) {
      logger.info('Content truncated', undefined, { original: content.length, truncated: MAX_CONTENT_CHARS });
      content = content.slice(0, MAX_CONTENT_CHARS);
    }

    logger.info('Calling GROQ for summarization', undefined, { contentLength: content.length });
  const jsonResponse = await getGroqSummary(content, customPersona);
    
    const duration = Date.now() - start;
    logger.info('URL summarization completed', undefined, { duration });
    logger.logResponse('POST', '/api/summarize-url', 200, duration);
    
    return NextResponse.json(jsonResponse, {
      headers: {
        'x-content-source': contentSource,
      }
    });

  } catch (error) {
    const duration = Date.now() - start;
    logger.error("Error in /api/summarize-url", error as Error);
    logger.logResponse('POST', '/api/summarize-url', 500, duration);
    
    return NextResponse.json({ 
      error: "Failed to process the request. Please try again." 
    }, { status: 500 });
  }
}