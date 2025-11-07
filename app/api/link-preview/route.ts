import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LinkPreviewResponse = {
  title?: string;
  description?: string;
  imageUrl?: string;
  favicon?: string;
};

export async function POST(req: NextRequest) {
  const logger = createRequestLogger(req);
  const startTime = Date.now();
  
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      logger.logResponse('POST', '/api/link-preview', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (_error) {
      logger.logResponse('POST', '/api/link-preview', 400, Date.now() - startTime);
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SmartSummarizer/1.0; +https://smartsummarizer.app)',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      logger.logResponse('POST', '/api/link-preview', 502, Date.now() - startTime);
      return NextResponse.json(
        { error: 'Failed to fetch URL', status: response.status },
        { status: 502 }
      );
    }

    const html = await response.text();
    
    // Extract metadata
    const preview: LinkPreviewResponse = {
      title: extractMetaTag(html, 'og:title') || extractTitle(html),
      description: extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description'),
      imageUrl: extractMetaTag(html, 'og:image'),
      favicon: extractFavicon(html, parsedUrl),
    };

    logger.logResponse('POST', '/api/link-preview', 200, Date.now() - startTime, {
      hasTitle: !!preview.title,
      hasImage: !!preview.imageUrl,
    });
    return NextResponse.json(preview);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Link preview error', undefined, undefined, {
      errorMessage,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    
    logger.logResponse('POST', '/api/link-preview', 500, Date.now() - startTime);
    return NextResponse.json(
      { error: 'Failed to generate link preview', details: errorMessage },
      { status: 500 }
    );
  }
}

// Helper functions
function extractMetaTag(html: string, property: string): string | undefined {
  // Try Open Graph tags
  const ogRegex = new RegExp(`<meta\\s+property=["']og:${property}["']\\s+content=["']([^"']+)["']`, 'i');
  const ogMatch = html.match(ogRegex);
  if (ogMatch?.[1]) return ogMatch[1];

  // Try standard meta tags
  const metaRegex = new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
  const metaMatch = html.match(metaRegex);
  if (metaMatch?.[1]) return metaMatch[1];

  // Try reversed attribute order
  const reversedRegex = new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["'](?:og:)?${property}["']`, 'i');
  const reversedMatch = html.match(reversedRegex);
  if (reversedMatch?.[1]) return reversedMatch[1];

  return undefined;
}

function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim();
}

function extractFavicon(html: string, baseUrl: URL): string | undefined {
  // Try to find icon in HTML
  const iconRegex = /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i;
  const iconMatch = html.match(iconRegex);
  
  if (iconMatch?.[1]) {
    const iconUrl = iconMatch[1];
    // Make absolute URL if relative
    if (iconUrl.startsWith('http')) {
      return iconUrl;
    } else if (iconUrl.startsWith('//')) {
      return `${baseUrl.protocol}${iconUrl}`;
    } else if (iconUrl.startsWith('/')) {
      return `${baseUrl.origin}${iconUrl}`;
    } else {
      return `${baseUrl.origin}/${iconUrl}`;
    }
  }

  // Default to /favicon.ico
  return `${baseUrl.origin}/favicon.ico`;
}
