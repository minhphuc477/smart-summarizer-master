import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

/**
 * Debug endpoint to check authentication status
 * Returns detailed auth information for troubleshooting
 */
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    
    // Get authentication status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Get cookies from request
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sbCookies = cookies.filter(c => c.startsWith('sb-'));
    const hasSbAccessToken = cookieHeader.includes('sb-') && cookieHeader.includes('access-token');
    const hasSbRefreshToken = cookieHeader.includes('sb-') && cookieHeader.includes('refresh-token');
    
    return NextResponse.json({
      authenticated: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      } : null,
      session: session ? {
        expires_at: session.expires_at,
        user_id: session.user?.id,
      } : null,
      cookies: {
        hasAccessToken: hasSbAccessToken,
        hasRefreshToken: hasSbRefreshToken,
        cookieCount: cookies.length,
        supabaseCookieCount: sbCookies.length,
        supabaseCookieNames: sbCookies.map(c => c.split('=')[0]),
      },
      errors: {
        authError: authError?.message || null,
        sessionError: sessionError?.message || null,
      },
      rawCookieHeader: cookieHeader ? `${cookieHeader.substring(0, 100)}...` : 'No cookies',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
