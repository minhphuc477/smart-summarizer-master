import { POST as workerPost } from '@/app/api/embedding/worker/route';
import { GET as metricsGet } from '@/app/api/embedding/metrics/route';

// Mock the transformers pipeline
const mockPipeline = jest.fn(async () => ({ 
  data: new Float32Array(384).fill(0.01) 
}));

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(async () => mockPipeline)
}));

// Mock Supabase with proper return types
const mockSupabaseClient = {
  from: (table: string) => {
    if (table === 'embedding_jobs') {
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              order: () => ({
                limit: async () => ({ 
                  data: [
                    { id: 1, note_id: 100, attempts: 0 },
                    { id: 2, note_id: 101, attempts: 1 }
                  ], 
                  error: null 
                })
              })
            })
          })
        }),
        update: () => ({ 
          eq: async () => ({ data: {}, error: null }) 
        })
      };
    } else if (table === 'notes') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ 
              data: { 
                id: 100,
                original_notes: 'Test note content', 
                summary: 'Test summary', 
                takeaways: ['takeaway 1', 'takeaway 2'] 
              },
              error: null
            })
          })
        }),
        update: () => ({ 
          eq: async () => ({ data: {}, error: null }) 
        })
      };
    } else if (table === 'embedding_metrics') {
      return {
        insert: async () => ({ data: {}, error: null }),
        select: async () => ({
          data: [
            { duration_ms: 100, model_name: 'Xenova/all-MiniLM-L6-v2', created_at: '2024-01-01' },
            { duration_ms: 200, model_name: 'Xenova/all-MiniLM-L6-v2', created_at: '2024-01-02' },
            { duration_ms: 150, model_name: 'Xenova/all-MiniLM-L6-v2', created_at: '2024-01-03' }
          ],
          error: null
        })
      };
    }
    return {
      select: async () => ({ data: [], error: null })
    };
  }
};

jest.mock('@/lib/supabaseServer', () => ({
  getServerSupabase: jest.fn(async () => mockSupabaseClient)
}));

jest.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({ 
    logResponse: jest.fn(), 
    info: jest.fn(), 
    warn: jest.fn(), 
    error: jest.fn(),
    debug: jest.fn()
  })
}));

describe('Embedding worker endpoint', () => {
  it('processes batch successfully and returns 200', async () => {
    const req = new Request('http://localhost/api/embedding/worker', { 
      method: 'POST', 
      body: JSON.stringify({ batchSize: 5 }) 
    });
    
    const res = await workerPost(req as any);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
    
    // Verify response has headers (indicates it's a proper NextResponse)
    expect(res.headers).toBeDefined();
  });

  it('handles invalid request gracefully', async () => {
    const req = new Request('http://localhost/api/embedding/worker', { 
      method: 'POST', 
      body: 'invalid json' 
    });
    
    const res = await workerPost(req as any);
    expect(res).toBeDefined();
    // Should still return 200 because we catch json parse errors and use defaults
    expect(res.status).toBe(200);
  });
});

describe('Embedding metrics endpoint', () => {
  it('returns metrics successfully with 200', async () => {
    const req = new Request('http://localhost/api/embedding/metrics', { 
      method: 'GET' 
    });
    
    const res = await metricsGet(req as any);
    expect(res).toBeDefined();
    expect(res.status).toBe(200);
    
    // Verify response has headers
    expect(res.headers).toBeDefined();
  });
});
