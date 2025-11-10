-- =====================================================
-- DIAGNOSTIC: Check Current State Before Fix
-- =====================================================
-- Run this BEFORE applying MASTER_FIX.sql to see what's broken

-- 1. Check if search functions exist
SELECT 
  '🔍 Search Functions' as check_name,
  COALESCE(
    (SELECT string_agg(routine_name, ', ')
     FROM information_schema.routines 
     WHERE routine_name LIKE 'match_notes%' 
       AND routine_schema = 'public'),
    '❌ MISSING'
  ) as status;

-- 2. Check vector extension
SELECT 
  '🧮 Vector Extension' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
    THEN '✅ Installed'
    ELSE '❌ Not installed'
  END as status;

-- 3. Check workspaces
SELECT 
  '🏢 Workspaces' as check_name,
  COUNT(*)::text || ' workspaces found' as status
FROM workspaces;

-- 4. Check workspace members
SELECT 
  '👥 Workspace Members' as check_name,
  COUNT(*)::text || ' members total' as status
FROM workspace_members;

-- 5. Check notes with embeddings
SELECT 
  '📝 Notes with Embeddings' as check_name,
  COUNT(embedding)::text || ' out of ' || COUNT(*)::text || ' notes' as status
FROM notes;

-- 6. Check RLS policy on workspace_members
SELECT 
  '🔒 Workspace Members RLS' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'workspace_members' 
        AND policyname = 'Owners and admins can add members'
        AND with_check::text LIKE '%owner_id = auth.uid()%'
    )
    THEN '✅ Policy allows owner to add self'
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'workspace_members' 
        AND policyname = 'Owners and admins can add members'
    )
    THEN '⚠️ Policy exists but may not allow owner'
    ELSE '❌ Policy missing'
  END as status;

-- 7. Check PDFs
SELECT 
  '📄 PDFs' as check_name,
  COUNT(*)::text || ' PDFs (' ||
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::text || ' completed, ' ||
  SUM(CASE WHEN status = 'uploading' THEN 1 ELSE 0 END)::text || ' stuck uploading)' as status
FROM pdfs;

-- 8. Check usage events for active time
SELECT 
  '⏱️ Usage Events' as check_name,
  COUNT(*)::text || ' events recorded' as status
FROM usage_events;

-- Summary
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━' as summary,
  '' as details
UNION ALL
SELECT 
  '📊 DIAGNOSIS SUMMARY' as summary,
  'Review the status above. Items marked ❌ need fixing.' as details;
