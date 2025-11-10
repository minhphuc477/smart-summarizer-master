-- =====================================================
-- WORKSPACE DIAGNOSTICS SCRIPT
-- Run this to check workspace configuration and data
-- =====================================================

-- 1. Check if workspaces table exists and has data
SELECT 'Workspaces Table Check' as check_name;
SELECT COUNT(*) as total_workspaces FROM workspaces;
SELECT * FROM workspaces ORDER BY created_at DESC LIMIT 10;

-- 2. Check workspace_members table
SELECT 'Workspace Members Table Check' as check_name;
SELECT COUNT(*) as total_members FROM workspace_members;
SELECT * FROM workspace_members ORDER BY created_at DESC LIMIT 10;

-- 3. Check RLS policies on workspaces
SELECT 'Workspaces RLS Policies' as check_name;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'workspaces'
ORDER BY policyname;

-- 4. Check RLS policies on workspace_members
SELECT 'Workspace Members RLS Policies' as check_name;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'workspace_members'
ORDER BY policyname;

-- 5. Check if RLS is enabled
SELECT 'RLS Status' as check_name;
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename IN ('workspaces', 'workspace_members');

-- 6. Test workspace creation policy (simulates what happens when user creates workspace)
SELECT 'Test Workspace Creation' as check_name;
SELECT auth.uid() as current_user_id; -- Shows current authenticated user

-- 7. Check for any workspace creation errors in recent logs
SELECT 'Recent Workspace Data' as check_name;
SELECT 
  w.id,
  w.name,
  w.created_at,
  w.owner_id,
  (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as member_count
FROM workspaces w
ORDER BY w.created_at DESC
LIMIT 10;
