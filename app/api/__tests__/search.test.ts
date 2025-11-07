// Provide mocks before importing route to avoid ESM parsing issues
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(async () => async () => ({ data: new Float32Array([0.1, 0.2, 0.3]) }))
}), { virtual: true } as any);

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null })
  }))
}));

let postHandler: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST: postHandler } = await import('../search/route'));
});

describe('POST /api/search', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/search',
    headers: new Headers(),
    method: 'POST'
  } as unknown as Request);

  test('requires search query', async () => {
    const req = mockRequest({ userId: 'user-123' });
    const response = await postHandler(req);
    expect(response.status).toBe(400);
  });

  test('accepts valid search request', async () => {
    const req = mockRequest({
      query: 'project management',
      userId: 'user-123',
      matchCount: 10
    });
    
  const response = await postHandler(req);
    expect(response.status).toBeLessThan(500);
  });

  test('handles search without userId (public search)', async () => {
    const req = mockRequest({
      query: 'test query',
      matchThreshold: 0.75
    });
    
  const response = await postHandler(req);
    expect(response.status).toBeLessThan(500);
  });
});
