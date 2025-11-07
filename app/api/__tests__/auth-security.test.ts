import { GET as GET_FOLDERS } from '@/app/api/folders/route';
import { GET as GET_CANVAS } from '@/app/api/canvases/[id]/route';

jest.mock('@/lib/supabaseServer');

jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) };
  const from = jest.fn((table: string) => {
    switch (table) {
      case 'folder_stats':
        return { select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) } as any;
      case 'canvases':
        return { select: () => ({ eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'owner', is_public: false }, error: null }) }) }) } as any;
      default:
        return { select: () => ({ data: [], error: null }) } as any;
    }
  });
  return { supabase: { auth, from } };
});

describe('Auth/Security boundaries', () => {
  it('folders GET returns 401 when unauthenticated', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Unauthenticated user for this test
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: null }, error: null })) },
      from: jest.fn(() => ({ select: () => ({ data: [], error: null }) }))
    });
    const res = await GET_FOLDERS({} as any);
    expect(res.status).toBe(401);
  });

  it('canvas GET returns 403 when unauthenticated and private', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Unauthenticated user for canvas route too
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: null }, error: null })) },
      from: jest.fn((table: string) => {
        if (table === 'canvases') {
          return {
            select: () => ({ eq: () => ({ single: () => ({ data: { id: 'c1', user_id: 'owner', is_public: false }, error: null }) }) })
          } as any;
        }
        return { select: () => ({ data: [], error: null }) } as any;
      })
    });
    const res = await GET_CANVAS({} as any, { params: Promise.resolve({ id: 'c1' }) } as any);
    expect([401, 403]).toContain(res.status);
  });
});
