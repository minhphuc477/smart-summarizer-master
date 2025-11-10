import { GET as versionsGet, POST as versionsPost } from '@/app/api/canvases/[id]/versions/route';
import { POST as restorePost } from '@/app/api/canvases/[id]/versions/[versionId]/restore/route';

// In-memory fixtures to simulate DB tables
const db = {
  canvases: [{ id: 'cv-1', user_id: 'user-1', title: 'Canvas A', description: 'Desc' }],
  canvas_nodes: [
    { id: 'n1', canvas_id: 'cv-1', type: 'text', data: { label: 'Hello' }, position: { x: 0, y: 0 } }
  ],
  canvas_edges: [],
  canvas_versions: [
    { id: 1, canvas_id: 'cv-1', user_id: 'user-1', version_number: 1, snapshot_data: { title: 'Canvas A', description: 'Desc', nodes: [], edges: [] }, snapshot_type: 'auto', created_at: new Date().toISOString() }
  ] as any[]
};

// Minimal Supabase client mock with the methods used by handlers
const mockSupabaseClient = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null })
  },
  from: (table: string) => {
    switch (table) {
      case 'canvases':
        return {
          select: (_cols?: any) => ({
            eq: (col: string, val: any) => ({
              single: async () => {
                // use loose equality to allow numeric IDs passed as strings (e.g. '99')
                const row = (db.canvases as any[]).find(r => r[col] == val);
                return { data: row || null, error: null };
              }
            })
          }),
          update: (vals: any) => ({
            eq: (col: string, val: any) => {
              const idx = (db.canvases as any[]).findIndex(r => r[col] == val);
              if (idx >= 0) (db.canvases as any[])[idx] = { ...(db.canvases as any[])[idx], ...vals };
              return { data: null, error: null };
            }
          })
        };
      case 'canvas_nodes':
        return {
          select: () => ({
            eq: async (_col: string, val: any) => ({ data: db.canvas_nodes.filter(n => n.canvas_id === val), error: null })
          }),
          delete: () => ({
            eq: async (_col: string, val: any) => {
              (db.canvas_nodes as any[]) = db.canvas_nodes.filter(n => n.canvas_id !== val);
              return { data: null, error: null };
            }
          }),
          insert: async (rows: any[]) => {
            (db.canvas_nodes as any[]).push(...rows);
            return { data: rows, error: null };
          }
        };
      case 'canvas_edges':
        return {
          select: () => ({
            eq: async (_col: string, val: any) => ({ data: db.canvas_edges.filter(e => e.canvas_id === val), error: null })
          }),
          delete: () => ({
            eq: async (_col: string, val: any) => {
              (db.canvas_edges as any[]) = db.canvas_edges.filter(e => e.canvas_id !== val);
              return { data: null, error: null };
            }
          }),
          insert: async (rows: any[]) => {
            (db.canvas_edges as any[]).push(...rows);
            return { data: rows, error: null };
          }
        };
      case 'canvas_versions':
        return {
          select: (_cols?: any) => {
            // allow chaining multiple .eq calls like real Supabase client
            const state: any = {
              filters: [] as any[],
              ascending: false,
              limitCount: undefined as number | undefined,
              eq: function(col: string, val: any) {
                this.filters.push({ col, val });
                return this;
              },
              order: function({ ascending }: { ascending: boolean }) {
                this.ascending = ascending;
                return this;
              },
              limit: function(n: number) {
                this.limitCount = n;
                return this;
              },
              async single() {
                let list = (db.canvas_versions as any[]).filter(r =>
                  this.filters.every((f: any) => r[f.col] == f.val)
                );
                list = list.sort((a: any, b: any) => (this.ascending ? a.version_number - b.version_number : b.version_number - a.version_number));
                const res = this.limitCount != null ? list.slice(0, this.limitCount)[0] || null : list[0] || null;
                return { data: res, error: null };
              },
              async then(resolver: any) {
                let list = (db.canvas_versions as any[]).filter(r =>
                  this.filters.every((f: any) => r[f.col] == f.val)
                );
                list = list.sort((a: any, b: any) => (this.ascending ? a.version_number - b.version_number : b.version_number - a.version_number));
                if (this.limitCount != null) list = list.slice(0, this.limitCount);
                return resolver({ data: list, error: null });
              }
            };
            return state;
          },
          insert: (row: any) => ({
            select: () => ({
              async single() {
                const id = Math.max(0, ...db.canvas_versions.map(v => v.id || 0)) + 1;
                const rec = { id, created_at: new Date().toISOString(), ...row };
                db.canvas_versions.push(rec);
                return { data: rec, error: null };
              }
            })
          })
        };
      default:
        return { select: async () => ({ data: [], error: null }) } as any;
    }
  }
} as any;

jest.mock('@/lib/supabaseServer', () => ({
  getServerSupabase: jest.fn(async () => mockSupabaseClient)
}));

jest.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    logResponse: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  })
}));

describe('Canvas Versions API', () => {
  it('GET /api/canvases/:id/versions returns 200 with list', async () => {
    const req = new Request('http://localhost/api/canvases/cv-1/versions', { method: 'GET' });
    const ctx = { params: Promise.resolve({ id: 'cv-1' }) } as any;
    const res = await versionsGet(req as any, ctx);
    expect(res.status).toBe(200);
  });

  it('POST /api/canvases/:id/versions creates manual snapshot (201)', async () => {
    const req = new Request('http://localhost/api/canvases/cv-1/versions', { method: 'POST', body: JSON.stringify({ change_description: 'manual' }) });
    const ctx = { params: Promise.resolve({ id: 'cv-1' }) } as any;
    const res = await versionsPost(req as any, ctx);
    expect(res.status).toBe(201);
  });

  it('POST /api/canvases/:id/versions/:versionId/restore restores snapshot (200)', async () => {
    // Ensure a second version exists to restore
    db.canvas_versions.push({ id: 99, canvas_id: 'cv-1', user_id: 'user-1', version_number: 2, snapshot_data: { title: 'Restored', description: 'R', nodes: [], edges: [] }, snapshot_type: 'manual', created_at: new Date().toISOString() });

    const req = new Request('http://localhost/api/canvases/cv-1/versions/99/restore', { method: 'POST' });
    const ctx = { params: Promise.resolve({ id: 'cv-1', versionId: '99' }) } as any;
    const res = await restorePost(req as any, ctx);
    expect(res.status).toBe(200);
  });
});
