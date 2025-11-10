// Use the auto-mock from __mocks__/supabaseServer.ts
jest.mock('@/lib/supabaseServer');

// Legacy mock for old client-based code (not used by analytics route anymore)
jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }) };
  const from = jest.fn((table: string) => {
    switch (table) {
      case 'user_analytics':
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: [{ date: '2025-01-01' }], error: null }) }) }) }) } as any;
      case 'user_analytics_summary':
        return { select: () => ({ eq: () => ({ single: () => ({ data: { total_notes: 10 }, error: null }) }) }) } as any;
      case 'usage_events':
        return {
          select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
          insert: () => ({ data: null, error: null }),
        } as any;
      case 'note_tags':
        return { select: () => ({ limit: () => ({ data: [{ tags: { name: 'work' } }, { tags: { name: 'ideas' } }], error: null }) }) } as any;
      case 'notes':
        return { select: () => ({ eq: () => ({ gte: () => ({ order: () => ({ data: [{ sentiment: 'positive', created_at: '2025-01-01T00:00:00Z' }], error: null }) }) }) }) } as any;
      default:
        return { select: () => ({ data: [], error: null }) } as any;
    }
  });
  const rpc = jest.fn(() => ({ data: null, error: null }));
  return { supabase: { auth, from, rpc } };
});

describe('/api/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // The route expects a shape like { supabase: { auth, from, rpc } }, so return the mocked client under `supabase`.
    getServerSupabase.mockResolvedValue({
      supabase: {
        auth: { 
          getUser: jest.fn(async () => ({ 
            data: { user: { id: 'user-1' } }, 
            error: null 
          })) 
        },
        from: jest.fn((table: string) => {
          if (table === 'user_analytics') {
            return {
              select: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({ 
                      data: [{ date: '2025-01-01', notes_created: 5 }], 
                      error: null 
                    })
                  })
                })
              })
            } as any;
          }
          if (table === 'usage_events') {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({ 
                      data: [], 
                      error: null 
                    })
                  })
                })
              }),
              insert: () => ({ data: null, error: null }),
            } as any;
          }
          if (table === 'note_tags') {
            return {
              select: () => ({
                limit: () => ({ 
                  data: [{ tags: { name: 'work' } }], 
                  error: null 
                })
              })
            } as any;
          }
          if (table === 'notes') {
            return {
              select: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({ 
                      data: [{ sentiment: 'positive', created_at: '2025-01-01' }], 
                      error: null 
                    })
                  })
                })
              })
            } as any;
          }
          return { select: () => ({ data: [], error: null }) } as any;
        }),
        rpc: jest.fn((fn: string) => {
          if (fn === 'get_user_analytics_summary') {
            return {
              single: jest.fn(async () => ({
                data: { total_notes: 10, total_summaries: 10 },
                error: null,
              })),
            } as any;
          }
          // For other RPC calls return a response-shaped object so callers that expect { data, error } or chain .catch won't throw
          return { data: null, error: null } as any;
        })
      }
    });
  });
  
  it('GET returns analytics aggregate data', async () => {
    const { GET } = require('@/app/api/analytics/route');
    
    const req = new Request('http://localhost/api/analytics?range=7');
    const res = await GET(req as any);
    if (res.status !== 200) {
      const body = await res.json();
      console.error('Response error:', body);
    }
    expect(res.status).toBe(200);
  });

  it('POST validates event_type and tracks', async () => {
    const { POST } = require('@/app/api/analytics/route');
    
    const bad = new Request('http://localhost/api/analytics', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
    const badRes = await POST(bad as any);
    expect([400, 401]).toContain(badRes.status);

    const good = new Request('http://localhost/api/analytics', { method: 'POST', body: JSON.stringify({ event_type: 'note_created', event_data: {} }), headers: { 'Content-Type': 'application/json' } });
    const okRes = await POST(good as any);
    expect(okRes.status).toBe(200);
  });
});
