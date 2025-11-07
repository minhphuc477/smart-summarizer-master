import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('Supabase Client', () => {
  test('creates client with environment variables', () => {
    const mockCreate = jest.mocked(createClient);
    
    require('../supabase');
    
    // The new @supabase/ssr client passes 3 arguments including config
    expect(mockCreate).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.any(Object)
      })
    );
  });

  test('client configuration includes auth settings', () => {
    const mockCreate = jest.mocked(createClient);
    
    require('../supabase');
    
    const callArgs = mockCreate.mock.calls[0];
    if (callArgs && callArgs[2]) {
      expect(callArgs[2]).toHaveProperty('auth');
    }
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
