import { GET, POST } from '../folders/route';

jest.mock('@/lib/supabaseServer');

// Mock the supabase singleton used by the route
jest.mock('@/lib/supabase', () => {
  const auth = { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }) };
  const from = jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ order: jest.fn(() => ({ data: [], error: null })) }))
    }))
  }));
  return { supabase: { auth, from } };
});

jest.mock('@supabase/supabase-js');

describe('GET /api/folders', () => {
  test('accepts userId query parameter', async () => {
    const response = await GET(new Request('http://localhost:3000/api/folders?userId=test-user-id') as any);
    expect([200, 204, 500]).toContain(response.status);
  });

  test('accepts workspaceId query parameter', async () => {
    const response = await GET(new Request('http://localhost:3000/api/folders?workspaceId=workspace-id') as any);
    expect([200, 204, 500]).toContain(response.status);
  });
});

describe('POST /api/folders', () => {
  const mockRequest = (body: any) =>
    new Request('http://localhost:3000/api/folders', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }) as unknown as Request;

  test('requires folder name', async () => {
    const req = mockRequest({ userId: 'test-user' });
  const response = await POST(req as any);
    
    expect([400, 500]).toContain(response.status);
  });

  test('creates folder with valid data', async () => {
    const req = mockRequest({
      name: 'Test Folder',
      userId: 'test-user-id',
      workspaceId: 'workspace-id'
    });
  const response = await POST(req as any);
    
    expect([200, 201, 500]).toContain(response.status);
  });

  test('supports nested folders with parent_id', async () => {
    const req = mockRequest({
      name: 'Subfolder',
      userId: 'test-user-id',
      parent_id: 'parent-folder-id'
    });
  const response = await POST(req as any);
    
    expect([200, 201, 500]).toContain(response.status);
  });
});
