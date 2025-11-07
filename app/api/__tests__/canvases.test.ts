import { GET, POST } from '@/app/api/canvases/route';

jest.mock('@/lib/supabaseServer');

jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }) };
  const from = jest.fn((table: string) => {
    if (table === 'canvases') {
      return {
        select: () => ({ order: () => ({ data: [{ id: 'c1' }], error: null }) }),
        insert: () => ({ select: () => ({ single: () => ({ data: { id: 'c2' }, error: null }) }) }),
      } as any;
    }
    return { select: () => ({ order: () => ({ data: [], error: null }) }) } as any;
  });
  const rpc = jest.fn(() => ({ data: null, error: null }));
  return { supabase: { auth, from, rpc } };
});

describe('/api/canvases root', () => {
  it('GET returns canvases for authenticated user', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('POST creates a new canvas', async () => {
    const req = new Request('http://localhost/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', workspace_id: 'w1' }),
    });
    const res = await POST(req as any);
    expect([200, 201]).toContain(res.status);
  });
});
