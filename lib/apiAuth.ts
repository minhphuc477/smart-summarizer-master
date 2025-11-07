import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, withRateLimit, logApiUsage, addRateLimitHeaders } from '@/lib/apiMiddleware';
import { getServerSupabase } from '@/lib/supabaseServer';

export type SessionOrApiKeyContext = { userId: string; apiKeyId?: string; scopes: string[]; mode: 'apiKey' | 'session' };

export function withSessionOrApiKey(
  handler: (req: NextRequest, context: SessionOrApiKeyContext) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();

    // Try API key path first
    const auth = await withApiAuth(req);
    if (auth.authorized && auth.apiKeyId && auth.userId) {
      // Rate limit for API key
      const rl = await withRateLimit(req, auth.apiKeyId, auth.userId);
      if (!rl.allowed) {
        await logApiUsage(auth.apiKeyId, new URL(req.url).pathname, req.method, 429, Date.now() - startTime, req, 'Rate limit exceeded');
        return rl.response!;
      }
      try {
        const res = await handler(req, { userId: auth.userId, apiKeyId: auth.apiKeyId, scopes: auth.scopes || [], mode: 'apiKey' });
        addRateLimitHeaders(res, rl);
        await logApiUsage(auth.apiKeyId, new URL(req.url).pathname, req.method, res.status, Date.now() - startTime, req);
        return res;
      } catch (e) {
        await logApiUsage(auth.apiKeyId, new URL(req.url).pathname, req.method, 500, Date.now() - startTime, req, e instanceof Error ? e.message : 'Internal error');
        throw e;
      }
    }

    // Fallback to session auth
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }
    // For session mode, grant 'admin' scope to bypass scope checks in routes
    return handler(req, { userId: user.id, scopes: ['admin'], mode: 'session' });
  };
}
