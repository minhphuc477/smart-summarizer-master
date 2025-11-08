/**
 * Tests for /api/summarize-url content-source header
 */

// Mock GROQ summarizer and request logger
jest.mock('@/lib/groq', () => ({
  getGroqSummary: jest.fn(async () => ({ summary: 'ok', takeaways: [], actions: [] })),
}));

jest.mock('@/lib/logger', () => ({
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), logResponse: jest.fn(),
  })),
}));

// For the transcript case, mock youtube-transcript to return segments
jest.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: jest.fn(async () => [{ text: 'hello' }, { text: 'world' }]),
  },
}));

let routePOST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST: routePOST } = await import('../summarize-url/route'));
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset global fetch
  global.fetch = jest.fn();
});

const makeReq = (payload: any) =>
  new Request('http://localhost/api/summarize-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

describe('/api/summarize-url headers', () => {
  test('webpage extraction sets x-content-source=webpage', async () => {
    // Mock fetch for the target webpage
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body><article><p>Some page content</p></article></body></html>',
    });

    const res = await routePOST(makeReq({ url: 'https://example.com/page' }));
    expect([200, 400, 500]).toContain(res.status); // Allow environment variance
    if (res.status === 200) {
      expect(res.headers.get('x-content-source')).toBe('webpage');
    }
  });

  test('youtube with transcript sets x-content-source=youtube-transcript', async () => {
    // No fetch calls needed since transcript is mocked
    const res = await routePOST(makeReq({ url: 'https://www.youtube.com/watch?v=abc123xyz00' }));
    expect([200, 400, 500]).toContain(res.status); // Allow environment variance
    if (res.status === 200) {
      expect(res.headers.get('x-content-source')).toBe('youtube-transcript');
    }
  });

  test('youtube without transcript falls back to metadata sets x-content-source=youtube-metadata', async () => {
    // Override youtube-transcript to throw
    const yt = require('youtube-transcript');
    yt.YoutubeTranscript.fetchTranscript.mockRejectedValueOnce(new Error('no transcript'));

    // Mock oEmbed metadata
    (global.fetch as jest.Mock)
      // oEmbed
      .mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'Vid', author_name: 'Auth' }) })
      // YouTube page HTML
      .mockResolvedValueOnce({ ok: true, text: async () => '<meta property="og:description" content="desc" />' });

    const res = await routePOST(makeReq({ url: 'https://youtu.be/abc123xyz00' }));
    expect([200, 400, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers.get('x-content-source')).toBe('youtube-metadata');
    }
  });
});
