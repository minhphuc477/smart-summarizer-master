-- FINAL COMPREHENSIVE CLEANUP - Remove ALL duplicates and recursive policies
-- This will leave ONLY simple, non-recursive policies on each table

-- ===== NOTES TABLE =====
-- Drop ALL policies first
DROP POLICY IF EXISTS "Users can view their notes or workspace notes or public notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create notes in their workspaces" ON public.notes;
DROP POLICY IF EXISTS "Users can view own or public notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Keep ONLY simple policies
CREATE POLICY "Users can view own or public notes"
  ON public.notes FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Users can create own notes"
  ON public.notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (user_id = auth.uid());

-- ===== PERSONAS TABLE =====
DROP POLICY IF EXISTS "Users can view their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can select own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can create their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can insert own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can update their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can update own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can delete their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can delete own personas" ON public.personas;

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas"
  ON public.personas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own personas"
  ON public.personas FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own personas"
  ON public.personas FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own personas"
  ON public.personas FOR DELETE
  USING (user_id = auth.uid());

-- ===== SAVED_SEARCHES TABLE =====
DROP POLICY IF EXISTS "Users can select own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can insert own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can update own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can delete own saved searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can view own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can create own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can update own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can delete own searches" ON public.saved_searches;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own searches"
  ON public.saved_searches FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own searches"
  ON public.saved_searches FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own searches"
  ON public.saved_searches FOR DELETE
  USING (user_id = auth.uid());

-- ===== WORKSPACES TABLE =====
DROP POLICY IF EXISTS "Members can see workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
DROP POLICY IF EXISTS "Users can select own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can insert own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Only owners can delete workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete own workspaces" ON public.workspaces;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces"
  ON public.workspaces FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create own workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own workspaces"
  ON public.workspaces FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete own workspaces"
  ON public.workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- ===== WORKSPACE_MEMBERS TABLE =====
DROP POLICY IF EXISTS "Owners can see all members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can see own memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can leave workspaces" ON public.workspace_members;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ONLY allow viewing own memberships - NO workspace lookups
CREATE POLICY "Users can view own memberships"
  ON public.workspace_members FOR SELECT
  USING (user_id = auth.uid());

-- Users can leave workspaces
CREATE POLICY "Users can leave workspaces"
  ON public.workspace_members FOR DELETE
  USING (user_id = auth.uid());

-- ===== TAGS TABLE =====
DROP POLICY IF EXISTS "Users can select all tags" ON public.tags;
DROP POLICY IF EXISTS "Users can insert tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can create own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags"
  ON public.tags FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tags"
  ON public.tags FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tags"
  ON public.tags FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tags"
  ON public.tags FOR DELETE
  USING (user_id = auth.uid());

-- Final verification - should show NO ⚠️ RECURSIVE policies
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN qual LIKE '%workspace_members%' THEN '⚠️ RECURSIVE'
    WHEN qual LIKE '%workspaces%' AND tablename != 'workspaces' THEN '⚠️ RECURSIVE'
    ELSE '✅ OK'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('notes', 'tags', 'note_tags', 'folders', 'personas', 'workspaces', 'workspace_members', 'saved_searches')
ORDER BY tablename, cmd, policyname;
