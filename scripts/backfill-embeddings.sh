#!/bin/bash
# Run embedding backfill after dimension migration
# This regenerates all embeddings with the new 384-dimension vectors

echo "🔄 Starting embedding backfill..."
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Dev server not running. Please start with: npm run dev"
    exit 1
fi

echo "✓ Server is running"
echo ""
echo "📊 Running backfill (this may take a while for large datasets)..."
echo ""

# Run backfill
# Read SUPABASE_SERVICE_ROLE_KEY from environment or .env.local (if present) and send as x-service-role header
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "$SERVICE_KEY" ] && [ -f ".env.local" ]; then
  SERVICE_KEY=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY' .env.local | sed -E 's/^[^=]*=//; s/^"//; s/"$//')
fi

if [ -n "$SERVICE_KEY" ]; then
  echo "Using SUPABASE_SERVICE_ROLE_KEY from environment/.env.local"
  curl -sS -X POST http://localhost:3000/api/admin/backfill-embeddings \
    -H "Content-Type: application/json" \
    -H "x-service-role: $SERVICE_KEY" \
    -d '{"limit": 100}' \
    -w "\n\nStatus: %{http_code}\n"
else
  echo "No SUPABASE_SERVICE_ROLE_KEY found; sending request without service-role header"
  curl -sS -X POST http://localhost:3000/api/admin/backfill-embeddings \
    -H "Content-Type: application/json" \
    -d '{"limit": 100}' \
    -w "\n\nStatus: %{http_code}\n"
fi

echo ""
echo "✓ Backfill request completed!"
echo ""
echo "Next steps:"
echo "1. Test semantic search in the UI"
echo "2. Search for any query - should show % similarity scores"
echo "3. No more 'showing keyword matches' fallback message"
