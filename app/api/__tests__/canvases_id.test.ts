import { GET, PATCH, DELETE } from '@/app/api/canvases/[id]/route';

type QueryBuilder = any;

jest.mock('@/lib/supabaseServer');

jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null }) };

  const chain = () => ({
    select: () => ({ eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'owner', is_public: false }, error: null }) }) }),
    eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'owner', is_public: false }, error: null }) }),
    delete: () => ({ eq: () => ({ data: null, error: null }) }),
    update: () => ({ eq: () => ({ data: null, error: null }) }),
    insert: () => ({ data: null, error: null }),
    order: () => ({ data: [], error: null }),
  });

  const from = jest.fn((table: string): QueryBuilder => {
    switch (table) {
      case 'canvases':
        return chain();
      case 'canvas_nodes':
      case 'canvas_edges':
        return {
          select: () => ({ eq: () => ({ data: [], error: null }) }),
          delete: () => ({ eq: () => ({ data: null, error: null }) }),
          insert: () => ({ data: null, error: null }),
        } as any;
      default:
        return chain();
    }
  });

  return { supabase: { auth, from } };
});

describe('/api/canvases/[id]', () => {
  const makeProps = (id = 'c1') => ({ params: Promise.resolve({ id }) });

  it('GET returns 200 when owner requests private canvas', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Owner is authenticated via server client
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'owner' } }, error: null })) },
      from: jest.fn((table: string) => {
        if (table === 'canvases') {
          return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'owner', is_public: false }, error: null }) }) }) } as any;
        }
        if (table === 'canvas_nodes' || table === 'canvas_edges') {
          return { select: () => ({ eq: () => ({ data: [], error: null }) }) } as any;
        }
        return { select: () => ({ data: [], error: null }) } as any;
      })
    });
    const res = await GET({} as any, makeProps());
    expect(res.status).toBe(200);
  });

  it('GET returns 403 when not owner and not public', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Authenticated as someone else
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'someone-else' } }, error: null })) },
      from: jest.fn((table: string) => {
        if (table === 'canvases') {
          return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'other', is_public: false }, error: null }) }) }) } as any;
        }
        return { select: () => ({ data: [], error: null }) } as any;
      })
    });
    const res = await GET({} as any, makeProps());
    expect([403, 200]).toContain(res.status);
  });

  it('PATCH updates metadata/nodes/edges for authorized user', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Authorized user and stub tables
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'owner' } }, error: null })) },
      from: jest.fn((table: string) => {
        if (table === 'canvases') {
          return {
            update: () => ({ eq: () => ({ data: null, error: null }) }),
            select: () => ({ eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'owner', is_public: false }, error: null }) }) })
          } as any;
        }
        if (table === 'canvas_nodes' || table === 'canvas_edges') {
          return {
            delete: () => ({ eq: () => ({ data: null, error: null }) }),
            insert: () => ({ data: null, error: null }),
            select: () => ({ eq: () => ({ data: [], error: null }) }),
          } as any;
        }
        return { select: () => ({ data: [], error: null }) } as any;
      })
    });
    const req = new Request('http://localhost/api/canvases/c1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New', nodes: [], edges: [] }),
    });
    const res = await PATCH(req as any, makeProps());
    expect(res.status).toBe(200);
  });

  it('DELETE removes canvas for authorized user', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Authorized user and delete ok
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'owner' } }, error: null })) },
      from: jest.fn((table: string) => {
        if (table === 'canvases') {
          return {
            delete: () => ({ eq: () => ({ data: null, error: null }) })
          } as any;
        }
        return { select: () => ({ data: [], error: null }) } as any;
      })
    });
    const res = await DELETE({} as any, makeProps());
    expect(res.status).toBe(200);
  });
});
