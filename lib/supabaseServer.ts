import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

// Returns a Supabase client bound to server request cookies when available.
export async function getServerSupabase() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    console.log('🍪 Server cookies:', {
      count: allCookies.length,
      supabaseCookies: allCookies.filter(c => c.name.startsWith('sb-')).map(c => c.name),
      hasAny: allCookies.length > 0,
    });
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Ignore errors in middleware/non-mutable contexts
              console.warn('Cookie setAll failed (possibly in middleware):', error);
            }
          },
        },
      }
    );
  } catch (error) {
    console.error('❌ Failed to create server Supabase client:', error);
    console.warn('⚠️  Falling back to anon client (auth will not work!)');
    // Fallback to plain client (no auth cookie binding)
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
}
