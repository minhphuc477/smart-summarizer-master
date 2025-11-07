#!/bin/bash
# Test script for API endpoints with the user ID from logs
# Usage: ./test-apis.sh

USER_ID="af5616ae-d19b-47fb-93c2-790f9cc40fd0"
BASE_URL="http://localhost:3000"

echo "Testing API endpoints with user ID: $USER_ID"
echo "================================================"
echo ""

# Test health endpoint
echo "1. Testing /api/health (no auth required)"
echo "---"
curl -s "$BASE_URL/api/health" | jq -C '.' || echo "Failed or not JSON"
echo ""
echo ""

# Test saved searches (should now return empty array instead of 500)
echo "2. Testing /api/search/saved?userId=$USER_ID"
echo "---"
curl -s "$BASE_URL/api/search/saved?userId=$USER_ID" | jq -C '.' || echo "Failed or not JSON"
echo ""
echo ""

# Test folders (will return 401 without auth)
echo "3. Testing /api/folders (expecting 401 without auth)"
echo "---"
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/api/folders" | head -20
echo ""
echo ""

# Test personas (will return 401 without auth)
echo "4. Testing /api/personas (expecting 401 without auth)"
echo "---"
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/api/personas" | head -20
echo ""
echo ""

# Test workspaces (will return 401 without auth)
echo "5. Testing /api/workspaces (expecting 401 without auth)"
echo "---"
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/api/workspaces" | head -20
echo ""
echo ""

# Test templates (may work without auth)
echo "6. Testing /api/templates (may return defaults)"
echo "---"
curl -s "$BASE_URL/api/templates" | jq -C '.templates | length' || echo "Failed or not JSON"
echo ""
echo ""

# Test search endpoint
echo "7. Testing /api/search with a simple query"
echo "---"
curl -s -X POST "$BASE_URL/api/search" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"test\",\"userId\":\"$USER_ID\"}" | jq -C '.results | length' || echo "Failed"
echo ""
echo ""

echo "================================================"
echo "Test complete!"
echo ""
echo "Summary:"
echo "- saved_searches should now return {items:[]} instead of 500"
echo "- folders/personas/workspaces return 401 (auth required)"
echo "- templates may work without auth"
echo "- search endpoint requires valid embeddings in DB"
