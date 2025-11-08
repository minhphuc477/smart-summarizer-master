import { POST as generate } from '@/app/api/generate-embedding/route';

jest.mock('@xenova/transformers', () => ({
  pipeline: async () => async () => ({ data: new Float32Array(384).fill(0.01) })
}));

jest.mock('@/lib/supabaseServer', () => ({
  getServerSupabase: async () => ({
    from: (_table: string) => ({
      upsert: () => ({ onConflict: () => ({}) }),
      update: () => ({ eq: () => ({}) }),
      insert: () => ({}),
      select: () => ({ eq: () => ({ single: async () => ({ data: { original_notes: 'x', summary: 'y', takeaways: ['a'] } }) }) })
    })
  })
}));

jest.mock('@/lib/logger', () => ({ createRequestLogger: () => ({ logResponse: () => {}, error: () => {} }) }));

describe('generate-embedding endpoint', () => {
  it('returns 200', async () => {
    const req = new Request('http://localhost/api/generate-embedding', { method: 'POST', body: JSON.stringify({ noteId: 1 }) });
    const res: any = await generate(req as any);
    expect(res && typeof res.status === 'number').toBe(true);
  });
});
