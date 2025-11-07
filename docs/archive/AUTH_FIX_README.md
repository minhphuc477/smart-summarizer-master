# Authentication Fix Summary

## Problem
After signing in with Google OAuth, API endpoints were returning 401 (Unauthorized) errors even though the user was authenticated.

## Root Cause
The `@supabase/ssr` package was installed but the `lib/supabaseServer.ts` was using an outdated cookie handling pattern that wasn't properly reading authentication cookies from requests.

## Solution

### 1. Fixed Server-Side Supabase Client (`lib/supabaseServer.ts`)
- Updated to use the modern `@supabase/ssr` API with `getAll()` and `setAll()` methods
- Properly reads auth cookies from Next.js 15's async `cookies()` API
- Added fallback error handling with logging

```typescript
import { createServerClient } from '@supabase/ssr'

export async function getServerSupabase() {
  const cookieStore = await cookies();
  
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}
```

### 2. Created API Fetch Utility (`lib/apiFetch.ts`)
- Wrapper around `fetch` that explicitly includes credentials
- Automatic JSON handling and error parsing
- Convenience methods: `api.get()`, `api.post()`, `api.patch()`, etc.

### 3. Added Monitoring Endpoints
- `/api/health` - Health check without auth (already existed)
- `/api/debug/auth` - Debug auth status and cookies

### 4. Created Test Script (`scripts/test-auth-flow.sh`)
Bash script to test authentication flow and API endpoints

## How to Test

### Test Without Auth (should return 401)
```bash
curl http://localhost:3000/api/workspaces
# Expected: {"error":"Unauthorized"} with 401 status
```

### Test Health Check (should return 200)
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok",...} with 200 status
```

### Test With Browser Auth
1. Sign in via the web UI (Google/GitHub OAuth)
2. Open DevTools → Network tab
3. Click on any API request
4. Check if cookies are present: `sb-*-auth-token`
5. API requests should now return 200 with data

### Debug Auth Status
```bash
curl http://localhost:3000/api/debug/auth
# Shows: authenticated, user info, session, cookies
```

### Run Full Test Suite
```bash
./scripts/test-auth-flow.sh
```

## Migration Guide for Components

### Before (old pattern):
```typescript
const response = await fetch('/api/folders');
```

### After (recommended):
```typescript
import { api } from '@/lib/apiFetch';

const folders = await api.get('/api/folders');
// or
const newFolder = await api.post('/api/folders', { name, description });
```

### Benefits:
- ✅ Explicit credentials handling
- ✅ Automatic JSON parsing
- ✅ Better error messages
- ✅ Type-safe response handling

## Verification Checklist

- [x] `@supabase/ssr` package installed (v0.5.2)
- [x] Server client uses modern cookie API
- [x] TypeScript compiles without errors
- [x] Health endpoint works (200)
- [x] Protected endpoints return 401 when unauthenticated
- [ ] After sign-in, protected endpoints return 200 ← **TEST THIS**

## Next Steps

1. **Test with real Google OAuth sign-in** in the browser
2. Optionally migrate existing components to use `lib/apiFetch.ts`
3. Check browser console for any auth-related warnings
4. Verify Supabase project has:
   - Google OAuth provider configured
   - Correct redirect URLs set
   - RLS policies enabled

## Troubleshooting

### Still Getting 401 After Sign-In?

1. Check browser cookies: DevTools → Application → Cookies
   - Should see `sb-*-auth-token` cookies
   
2. Check debug endpoint:
   ```bash
   curl http://localhost:3000/api/debug/auth
   ```
   
3. Check Supabase project settings:
   - Authentication → Providers → Google (enabled?)
   - Authentication → URL Configuration (correct redirects?)
   
4. Check environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   
5. Clear browser cache and cookies, try again

### Cookies Not Being Set?

- Check if running on HTTPS (required for secure cookies in production)
- Verify domain matches between app and Supabase project
- Check browser privacy settings (blocks third-party cookies?)

## Files Changed

- `lib/supabaseServer.ts` - Fixed cookie handling
- `lib/apiFetch.ts` - New authenticated fetch utility
- `app/api/debug/auth/route.ts` - New debug endpoint
- `scripts/test-auth-flow.sh` - New test script
- `AUTH_FIX_README.md` - This documentation
