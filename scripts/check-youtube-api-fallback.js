// Script to mimic /api/summarize-url YouTube fallback behavior:
// 1) Try to fetch transcript via youtube-transcript
// 2) If empty, try oEmbed (no-cors fallback)
// 3) If still short, fetch video page and extract og:description via jsdom
// Usage: node scripts/check-youtube-api-fallback.js <youtube-url>

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/check-youtube-api-fallback.js <youtube-url>');
  process.exit(2);
}

(async () => {
  console.log('Checking URL:', url);
  let transcriptText = '';
  
  // Import modules dynamically
  const { YoutubeTranscript } = await import('youtube-transcript');
  const { JSDOM } = await import('jsdom');
  
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    if (Array.isArray(transcript) && transcript.length) {
      transcriptText = transcript.map(p => p.text).join('\n');
      console.log('Transcript length:', transcriptText.length);
    } else {
      console.log('No transcript entries returned');
    }
  } catch (e) {
    console.log('Transcript fetch failed or unavailable:', e && e.message ? e.message : e);
  }

  let usedYouTubeMetadataFallback = false;
  let fallbackContent = '';

  if (!transcriptText || transcriptText.length < 100) {
    // try oEmbed
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oresp = await fetch(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
      if (oresp.ok) {
        const meta = await oresp.json();
        usedYouTubeMetadataFallback = true;
        fallbackContent = `Title: ${meta.title}\nAuthor: ${meta.author_name}`;
        console.log('oEmbed fetched — title:', meta.title);
      } else {
        console.log('oEmbed fetch returned', oresp.status);
      }
    } catch (e) {
      console.log('oEmbed fetch failed:', e && e.message ? e.message : e);
    }

    // Also try fetching the public page and extract og:description to enrich the fallback
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
      if (resp.ok) {
        const html = await resp.text();
        const dom = new JSDOM(html);
        const og = dom.window.document.querySelector('meta[property="og:description"]') || dom.window.document.querySelector('meta[name="description"]');
        if (og) {
          const desc = og.getAttribute('content') || '';
          if (desc) {
            fallbackContent += `\nDescription: ${desc}`;
            console.log('Found og:description length', desc.length);
          }
        } else {
          console.log('No og:description found on page');
        }
      } else {
        console.log('Video page fetch returned', resp.status);
      }
    } catch (e) {
      console.log('Video page fetch failed:', e && e.message ? e.message : e);
    }
  }

  const result = {
    hasTranscript: !!transcriptText,
    transcriptLength: transcriptText.length,
    usedYouTubeMetadataFallback,
    fallbackContentPreview: fallbackContent ? fallbackContent.slice(0, 800) : null
  };

  console.log('\n=== RESULT ===\n');
  console.log(JSON.stringify(result, null, 2));
})();