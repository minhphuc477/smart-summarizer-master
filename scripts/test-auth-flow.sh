#!/bin/bash
# Test authentication flow and API endpoints
# Usage: ./scripts/test-auth-flow.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000}"
COOKIE_FILE="/tmp/supabase-test-cookies.txt"

echo "🧪 Testing Smart Summarizer Authentication Flow"
echo "================================================"
echo "Base URL: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check (no auth)
echo "1️⃣  Testing Health Check (no auth required)..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Health check: OK (200)${NC}"
else
  echo -e "${RED}❌ Health check failed: $HEALTH_STATUS${NC}"
fi
echo ""

# Test 2: Root page (no auth)
echo "2️⃣  Testing Root Page (no auth required)..."
ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$ROOT_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Root page: OK (200)${NC}"
else
  echo -e "${RED}❌ Root page failed: $ROOT_STATUS${NC}"
fi
echo ""

# Test 3: Protected endpoints without auth (should 401)
echo "3️⃣  Testing Protected Endpoints (should return 401)..."
ENDPOINTS=("/api/workspaces" "/api/folders" "/api/personas")
for endpoint in "${ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  if [ "$STATUS" = "401" ]; then
    echo -e "${GREEN}✅ $endpoint: Correctly returns 401${NC}"
  else
    echo -e "${YELLOW}⚠️  $endpoint: Expected 401, got $STATUS${NC}"
  fi
done
echo ""

# Test 4: Debug auth endpoint
echo "4️⃣  Testing Debug Auth Endpoint..."
echo "Response from /api/debug/auth:"
curl -s "$BASE_URL/api/debug/auth" | jq '.' 2>/dev/null || echo "jq not installed, showing raw response:"
curl -s "$BASE_URL/api/debug/auth"
echo ""
echo ""

# Test 5: With cookies (simulating authenticated request)
echo "5️⃣  Testing with Session Cookies..."
echo -e "${YELLOW}ℹ️  To test with real auth, sign in via browser and copy cookies${NC}"
echo ""
echo "To extract cookies from browser:"
echo "1. Open DevTools → Application → Cookies"
echo "2. Copy all sb-*-auth-token cookies"
echo "3. Run: curl -H 'Cookie: <your-cookies>' $BASE_URL/api/workspaces"
echo ""

# Summary
echo "================================================"
echo "📊 Summary:"
echo "- Health check should return 200 ✓"
echo "- Root page should return 200 ✓"
echo "- Protected endpoints should return 401 when unauthenticated ✓"
echo "- After sign-in, endpoints should return 200 with data"
echo ""
echo "If you're getting 401 after signing in:"
echo "1. Check /api/debug/auth to see if cookies are present"
echo "2. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "3. Check browser console for auth errors"
echo "4. Ensure Supabase project has Google OAuth configured"
