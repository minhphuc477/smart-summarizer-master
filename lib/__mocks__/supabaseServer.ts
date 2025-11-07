// Jest auto-mock for @/lib/supabaseServer
export const getServerSupabase = jest.fn(async () => {
  const mockData = { data: [], error: null };
  const mockSingleData = { data: {}, error: null };
  const mockUser = { 
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
  };
  
  // Create a chainable query builder
  const createQueryBuilder = (): Record<string, unknown> => {
    const builder: Record<string, unknown> = {
      select: jest.fn(function() { return builder; }),
      insert: jest.fn(function() { return builder; }),
      update: jest.fn(function() { return builder; }),
      delete: jest.fn(function() { return builder; }),
      eq: jest.fn(function() { return builder; }),
      in: jest.fn(function() { return builder; }),
      gte: jest.fn(function() { return builder; }),
      lte: jest.fn(function() { return builder; }),
      gt: jest.fn(function() { return builder; }),
      lt: jest.fn(function() { return builder; }),
      neq: jest.fn(function() { return builder; }),
      order: jest.fn(function() { return builder; }),
      range: jest.fn(function() { return builder; }),
      limit: jest.fn(function() { return builder; }),
      single: jest.fn(async () => mockSingleData),
      maybeSingle: jest.fn(async () => mockSingleData),
      // Support both promise chaining and direct await
      then: jest.fn((callback: (value: unknown) => unknown) => Promise.resolve(mockData).then(callback)),
      catch: jest.fn((callback: (error: unknown) => unknown) => Promise.resolve(mockData).catch(callback)),
    };
    return builder;
  };
  
  return {
    auth: {
      getUser: jest.fn(async () => ({ 
        data: { user: mockUser }, 
        error: null 
      })),
      getSession: jest.fn(async () => ({
        data: { session: { user: mockUser } },
        error: null
      })),
    },
    from: jest.fn(() => createQueryBuilder()),
    rpc: jest.fn(async () => mockData),
  };
});
