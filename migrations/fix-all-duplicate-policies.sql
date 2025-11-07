-- Clean up ALL duplicate RLS policies across all tables
-- This script removes all existing policies and recreates clean, simple ones

-- ===== FOLDERS TABLE =====
DROP POLICY IF EXISTS "Users can select own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view their folders or workspace folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create folders in their workspaces" ON public.folders;

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
  ON public.folders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own folders"
  ON public.folders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (user_id = auth.uid());

-- ===== PERSONAS TABLE =====
DROP POLICY IF EXISTS "Users can select own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can insert own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can update own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can delete own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can view their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can create their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can update their own personas" ON public.personas;
DROP POLICY IF EXISTS "Users can delete their own personas" ON public.personas;

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

-- ===== NOTES TABLE =====
DROP POLICY IF EXISTS "Users can select own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Public notes are viewable by everyone" ON public.notes;
DROP POLICY IF EXISTS "Users can view notes shared with them" ON public.notes;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
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

-- ===== WORKSPACES TABLE =====
DROP POLICY IF EXISTS "Users can select own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can insert own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Only owners can delete workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Members can see workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;

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
DROP POLICY IF EXISTS "Users can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view member workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can select workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can insert members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can delete members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can see all members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can see own memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can leave workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Simple policies - no cross-table references to avoid recursion
CREATE POLICY "Users can view own memberships"
  ON public.workspace_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Workspace owners can view members"
  ON public.workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can remove members"
  ON public.workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave workspaces"
  ON public.workspace_members FOR DELETE
  USING (user_id = auth.uid());

-- Verify all policies
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('folders', 'personas', 'notes', 'workspaces', 'workspace_members')
ORDER BY tablename, cmd, policyname;
