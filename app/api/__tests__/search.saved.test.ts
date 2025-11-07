jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(function (this: any, table: string) {
      this._table = table;
      return this;
    }),
    select: jest.fn(function (this: any) { return this; }),
    eq: jest.fn(function (this: any) { return this; }),
    order: jest.fn(function (this: any) { return this; }),
    limit: jest.fn(async function (this: any) {
      if (this._table === 'saved_searches') {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    }),
    upsert: jest.fn(function (this: any) { return this; }),
    single: jest.fn(async function (this: any) {
      if (this._table === 'saved_searches') {
        return { data: { id: 1, name: 'foo', query: 'bar', filters: null }, error: null };
      }
      return { data: null, error: null };
    })
  }))
}));

let savedGetHandler: (req: Request) => Promise<Response>;
let savedPostHandler: (req: Request) => Promise<Response>;
beforeAll(async () => {
  const mod = await import('../search/saved/route');
  savedGetHandler = mod.GET;
  savedPostHandler = mod.POST;
});

describe('/api/search/saved', () => {
  test('GET returns empty list without userId', async () => {
    const req = { url: 'http://localhost:3000/api/search/saved', headers: new Headers(), method: 'GET' } as unknown as Request;
  const res = await savedGetHandler(req);
      // Returns 200 with empty list when no userId (graceful handling)
    expect(res.status).toBe(200);
  });

  test('GET returns items', async () => {
    const req = { url: 'http://localhost:3000/api/search/saved?userId=user-123', headers: new Headers(), method: 'GET' } as unknown as Request;
  const res = await savedGetHandler(req);
    expect(res.status).toBe(200);
  });

  test('POST requires authentication', async () => {
    const req = { json: async () => ({ name: 'a' }), url: 'http://localhost:3000/api/search/saved', headers: new Headers(), method: 'POST' } as unknown as Request;
  const res = await savedPostHandler(req);
    expect(res.status).toBe(401);
  });

  test('POST validates required fields', async () => {
    const req = { json: async () => ({ userId: 'user-123', name: 'a' }), url: 'http://localhost:3000/api/search/saved', headers: new Headers(), method: 'POST' } as unknown as Request;
  const res = await savedPostHandler(req);
    expect(res.status).toBe(400);
  });

  test('POST upserts saved search', async () => {
    const req = { json: async () => ({ userId: 'user-123', name: 'foo', query: 'bar' }), url: 'http://localhost:3000/api/search/saved', headers: new Headers(), method: 'POST' } as unknown as Request;
  const res = await savedPostHandler(req);
    expect(res.status).toBe(200);
  });
});
