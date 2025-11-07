/**
 * API Authentication & Rate Limiting Middleware
 * 
 * Provides authentication and rate limiting for Public API endpoints
 * 
 * Usage:
 * ```typescript
 * import { withApiAuth, withRateLimit } from '@/lib/apiMiddleware';
 * 
 * export async function GET(req: NextRequest) {
 *   const authResult = await withApiAuth(req);
 *   if (!authResult.authorized) {
 *     return authResult.response;
 *   }
 * 
 *   const rateLimitResult = await withRateLimit(req, authResult.apiKeyId);
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 * 
 *   // Your API logic here
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialize to avoid build-time errors
let supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}

interface ApiKeyValidation {
  authorized: boolean;
  apiKeyId?: string;
  userId?: string;
  scopes?: string[];
  response?: NextResponse;
}

interface RateLimitCheck {
  allowed: boolean;
  response?: NextResponse;
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }
  
  // Support both "Bearer sk_live_xxx" and "sk_live_xxx"
  const match = authHeader.match(/^(?:Bearer\s+)?(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Validate API key and return authorization result
 */
export async function withApiAuth(req: NextRequest): Promise<ApiKeyValidation> {
    const supabaseAdmin = getSupabaseAdmin();
  const apiKey = extractApiKey(req);
  
  if (!apiKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'API key is required. Include it in the Authorization header: Bearer sk_live_xxx'
        },
        { status: 401 }
      ),
    };
  }
  
  // Validate API key using database function
  const { rpc } = (supabaseAdmin as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> });
  const { data, error } = await rpc('validate_api_key', {
    api_key: apiKey,
  });
  
  const result = data as unknown as Array<{ is_valid: boolean; key_id: string; user_id: string; scopes?: string[] }> | null;
  if (error || !Array.isArray(result) || result.length === 0) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired API key'
        },
        { status: 401 }
      ),
    };
  }
  
  const keyData = result[0];
  
  if (!keyData.is_valid) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'API key is inactive or expired'
        },
        { status: 401 }
      ),
    };
  }
  
  return {
    authorized: true,
    apiKeyId: keyData.key_id,
    userId: keyData.user_id,
    scopes: keyData.scopes || [],
  };
}

/**
 * Check if scope is allowed for this API key
 */
export function hasScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes('admin') || scopes.includes(requiredScope);
}

/**
 * Rate limiting configuration by tier
 */
const RATE_LIMITS = {
  free: { requests: 100, windowMs: 3600000 }, // 100/hour
  personal: { requests: 1000, windowMs: 3600000 }, // 1000/hour
  pro: { requests: 10000, windowMs: 3600000 }, // 10000/hour
  team: { requests: 50000, windowMs: 3600000 }, // 50000/hour
};

/**
 * Get rate limit tier for user based on their subscription
 */
async function getRateLimitTier(userId: string): Promise<keyof typeof RATE_LIMITS> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Query user's subscription tier from user_preferences
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .select('subscription_tier')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // If no preferences found, return free tier
      return 'free';
    }

    // Validate and return the tier
    const preferences = data as { subscription_tier?: string };
    const tier = preferences.subscription_tier as keyof typeof RATE_LIMITS;
    
    if (tier && tier in RATE_LIMITS) {
      return tier;
    }

    // Default to free if invalid tier
    return 'free';
  } catch (error) {
    console.error('Error fetching user subscription tier:', error);
    return 'free'; // Default to free tier on error
  }
}

/**
 * Rate limiting using database queries
 */
export async function withRateLimit(
  req: NextRequest,
  apiKeyId: string,
  userId?: string
): Promise<RateLimitCheck> {
    const supabaseAdmin = getSupabaseAdmin();
  // Get user's rate limit tier
  const tier = userId ? await getRateLimitTier(userId) : 'free';
  const { requests: limit, windowMs } = RATE_LIMITS[tier];
  
  // Calculate time window
  const windowStart = new Date(Date.now() - windowMs);
  
  // Count requests in current window
  const { count, error } = await supabaseAdmin
    .from('api_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', windowStart.toISOString());
  
  if (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request if we can't check rate limit
    return {
      allowed: true,
      remaining: limit,
      limit,
      reset: Math.floor((Date.now() + windowMs) / 1000),
    };
  }
  
  const requestCount = count || 0;
  const remaining = Math.max(0, limit - requestCount);
  const reset = Math.floor((Date.now() + windowMs) / 1000);
  
  if (requestCount >= limit) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: `You have exceeded the rate limit of ${limit} requests per hour for your tier (${tier})`,
          limit,
          remaining: 0,
          reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil(windowMs / 1000).toString(),
          },
        }
      ),
      remaining: 0,
      limit,
      reset,
    };
  }
  
  return {
    allowed: true,
    remaining,
    limit,
    reset,
  };
}

/**
 * Log API usage for analytics and rate limiting
 */
export async function logApiUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  req: NextRequest,
  errorMessage?: string
) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    const client = supabaseAdmin as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
      }
    };
    await client.from('api_usage_logs').insert({
      api_key_id: apiKeyId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
    // Don't throw - logging failures shouldn't break API requests
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  rateLimit: RateLimitCheck
): NextResponse {
  response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimit.reset.toString());
  return response;
}

/**
 * Combined middleware wrapper for API routes
 * 
 * Usage:
 * ```typescript
 * export const GET = withApiMiddleware(async (req, context) => {
 *   // Your API logic here with context.userId, context.apiKeyId
 *   return NextResponse.json({ data: 'Hello' });
 * });
 * ```
 */
export function withApiMiddleware(
  handler: (req: NextRequest, context: { userId: string; apiKeyId: string; scopes: string[] }) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    
    // Authentication
    const authResult = await withApiAuth(req);
    if (!authResult.authorized || !authResult.apiKeyId || !authResult.userId) {
      return authResult.response!;
    }
    
    // Rate limiting
    const rateLimitResult = await withRateLimit(req, authResult.apiKeyId, authResult.userId);
    if (!rateLimitResult.allowed) {
      await logApiUsage(
        authResult.apiKeyId,
        new URL(req.url).pathname,
        req.method,
        429,
        Date.now() - startTime,
        req,
        'Rate limit exceeded'
      );
      return rateLimitResult.response!;
    }
    
    try {
      // Call the actual handler
      const response = await handler(req, {
        userId: authResult.userId,
        apiKeyId: authResult.apiKeyId,
        scopes: authResult.scopes || [],
      });
      
      // Add rate limit headers
      addRateLimitHeaders(response, rateLimitResult);
      
      // Log successful request
      await logApiUsage(
        authResult.apiKeyId,
        new URL(req.url).pathname,
        req.method,
        response.status,
        Date.now() - startTime,
        req
      );
      
      return response;
    } catch (error) {
      // Log error
      await logApiUsage(
        authResult.apiKeyId,
        new URL(req.url).pathname,
        req.method,
        500,
        Date.now() - startTime,
        req,
        error instanceof Error ? error.message : 'Internal server error'
      );
      
      throw error;
    }
  };
}

/**
 * Type guard for checking if user has required scope
 */
export function requireScope(scopes: string[], requiredScope: string): boolean {
  if (!hasScope(scopes, requiredScope)) {
    throw new Error(`Missing required scope: ${requiredScope}`);
  }
  return true;
}
