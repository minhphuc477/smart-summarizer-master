(async function(){
  const videoId = '7e00NogWdm4';
  try {
    const mod = await import('youtube-transcript');
    const { YoutubeTranscript } = mod;
    console.log('Attempting to fetch YouTube transcript for', videoId);
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      if (transcript && transcript.length) {
        const content = transcript.map(t => t.text).join(' ');
        console.log('Transcript length:', content.length);
        console.log('Content snippet:', content.slice(0,400));
        return;
      } else {
        console.log('Transcript empty');
      }
    } catch (err) {
      console.error('Transcript fetch error:', err.message || err);
    }

    console.log('Fetching oEmbed metadata fallback');
    const resp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!resp.ok) {
      console.error('oEmbed fetch failed with status', resp.status);
      return;
    }
    const meta = await resp.json();
    const title = meta?.title || 'Untitled Video';
    const author = meta?.author_name ? ` by ${meta.author_name}` : '';
    // Attempt to fetch the public video page and extract meta description
    let description = '';
    try {
      const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (pageResp.ok) {
        const html = await pageResp.text();
        try {
          const { JSDOM } = await import('jsdom');
          const dom = new JSDOM(html);
          const doc = dom.window.document;
          const og = doc.querySelector('meta[property="og:description"]');
          const nameDesc = doc.querySelector('meta[name="description"]');
          description = (og?.getAttribute('content') || nameDesc?.getAttribute('content') || '').trim();
        } catch (_e) {
          // ignore parsing errors
        }
      }
    } catch (_e) {
      // ignore network errors
    }

    const content = `Video Title: ${title}${author}.` + (description ? ` Description: ${description}` : '');
    const final = content + ' Transcript unavailable. Provide a summary focusing on probable educational or conceptual themes based on the title and description.';
    console.log('Fallback content length:', final.length);
    console.log('Fallback content:', final);
  } catch (err) {
    console.error('Fatal error', err);
  }
})();
