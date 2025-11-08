// Mock must be declared before any imports
const mockCreateBrowserClient = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    mockCreateBrowserClient.mockClear();
    mockCreateBrowserClient.mockReturnValue({} as any);
    jest.resetModules(); // Force module to be reloaded
  });

  test('handles missing environment variables gracefully', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    expect(() => require('../supabase')).not.toThrow();
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });
});
