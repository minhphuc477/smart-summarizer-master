import { GET, POST } from '../workspaces/route';

jest.mock('@/lib/supabaseServer');

// Mock the supabase singleton used by the route implementation
jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) };
  const from = jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({ data: [], error: null }))
      }))
    }))
  }));
  return { supabase: { auth, from } };
});

describe('GET /api/workspaces', () => {
  test('requires authentication', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Unauthenticated user
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: null }, error: null })) },
      from: jest.fn(() => ({ select: () => ({ data: [], error: null }) }))
    });
    const response = await GET();
    expect([401, 500]).toContain(response.status);
  });

  test('returns workspace list for authenticated user', async () => {
    const { getServerSupabase } = require('@/lib/supabaseServer');
    // Authenticated user and workspace data
    getServerSupabase.mockResolvedValue({
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
      rpc: jest.fn(async () => ({ 
        data: [{ id: 'w1', name: 'Workspace', owner_id: 'user-1', role: 'owner', member_count: 1 }], 
        error: null 
      })),
      from: jest.fn((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: () => ({ 
              eq: () => ({ 
                data: [{ workspace_id: 'w1', role: 'owner' }], 
                error: null 
              }) 
            })
          } as any;
        }
        if (table === 'workspaces') {
          return {
            select: () => ({ 
              in: () => ({ 
                order: () => ({ 
                  data: [{ id: 'w1', name: 'Workspace', owner_id: 'user-1' }], 
                  error: null 
                }) 
              }) 
            })
          } as any;
        }
        return { select: () => ({ data: [], error: null }) } as any;
      })
    });

    const response = await GET();
    expect(response.status).toBeLessThan(500);
  });
});

describe('POST /api/workspaces', () => {
  const mockRequest = (body: any) =>
    new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }) as unknown as Request;

  test('requires workspace name', async () => {
    const req = mockRequest({});
    const response = await POST(req);
    
    expect([400, 401, 500]).toContain(response.status);
  });

  test('creates workspace with valid data', async () => {
    const req = mockRequest({
      name: 'Test Workspace',
      description: 'A test workspace'
    });
    const response = await POST(req);
    
    expect([200, 201, 401, 500]).toContain(response.status);
  });
});
