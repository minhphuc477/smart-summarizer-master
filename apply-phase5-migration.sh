#!/bin/bash

# Phase 5 Real-time Collaboration Migration Script
# This script applies the database schema for comments, presence, and version history

echo "🚀 Phase 5: Real-time Collaboration Migration"
echo "=============================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    exit 1
fi

# Load environment variables
source .env.local

# Check if Supabase URL is set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not set in .env.local"
    exit 1
fi

echo "📋 This migration will create:"
echo "  • comments table with RLS policies"
echo "  • presence table for real-time user tracking"
echo "  • note_versions table for version history"
echo "  • comment_notifications table"
echo "  • Automatic triggers for version snapshots"
echo "  • Helper views and functions"
echo ""

echo "⚠️  IMPORTANT: You need to run this SQL manually in Supabase SQL Editor"
echo ""
echo "Instructions:"
echo "1. Go to: ${NEXT_PUBLIC_SUPABASE_URL/https:\/\//https://supabase.com/dashboard/project/}/sql/new"
echo "2. Copy the contents of: supabase-migration-realtime-collaboration.sql"
echo "3. Paste and run in the SQL Editor"
echo "4. Enable Realtime for new tables in Supabase Dashboard:"
echo "   Database → Replication → Enable for: comments, presence, note_versions"
echo ""

read -p "Press Enter when you've completed the migration..."

echo ""
echo "✅ Great! Now testing the connection..."

# Simple test to check if tables exist (requires Supabase CLI or curl)
echo "⏭️  Skipping automatic verification (requires Supabase CLI)"
echo ""
echo "🎉 Phase 5 migration instructions provided!"
echo ""
echo "Next steps:"
echo "  1. Verify tables created: comments, presence, note_versions"
echo "  2. Check RLS policies are active"
echo "  3. Enable Realtime in Supabase Dashboard"
echo "  4. Run: npm run dev"
echo "  5. Test real-time features in the app"
echo ""
