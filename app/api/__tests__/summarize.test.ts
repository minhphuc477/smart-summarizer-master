// Mock dependencies before importing route
jest.mock('@/lib/groq', () => ({
  getGroqSummary: jest.fn().mockResolvedValue({
    summary: 'Mock summary',
    takeaways: ['a', 'b'],
    actions: [],
    tags: ['tag1'],
    sentiment: 'neutral'
  })
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({ insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn().mockResolvedValue({ data: { id: 1 } }) })) })) })),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-123' } } }, error: null }) }
  }))
}));

let summarizePOST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST: summarizePOST } = await import('../summarize/route'));
});

describe('POST /api/summarize', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/summarize',
    headers: new Headers(),
    method: 'POST'
  } as unknown as Request);

  test('returns error when notes is missing', async () => {
    const req = mockRequest({ customPersona: 'Student' });
    const response = await summarizePOST(req);
    expect(response.status).toBe(400);
  });

  test('accepts guest mode request', async () => {
    const req = mockRequest({
      notes: 'Test notes content',
      isGuest: true
    });
    
  const response = await summarizePOST(req);
    expect(response.status).toBeLessThan(500);
  });

  test('accepts logged-in user request', async () => {
    const req = mockRequest({
      notes: 'User notes',
      userId: 'user-123',
      customPersona: 'Professional'
    });
    
  const response = await summarizePOST(req);
    expect(response.status).toBeLessThan(500);
  });
});
