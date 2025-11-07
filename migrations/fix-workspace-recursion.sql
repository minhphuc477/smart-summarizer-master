-- Fix the infinite recursion in workspace_members RLS policies
-- This happens when policies reference each other in a loop

-- Drop all existing policies on workspace_members
DROP POLICY IF EXISTS "Users can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view member workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can select workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can insert members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can delete members" ON public.workspace_members;

-- Enable RLS
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- Users can see memberships for workspaces they own
CREATE POLICY "Owners can see all members"
  ON public.workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Users can see their own memberships
CREATE POLICY "Users can see own memberships"
  ON public.workspace_members FOR SELECT
  USING (auth.uid() = user_id);

-- Workspace owners can add members
CREATE POLICY "Owners can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Workspace owners can remove members
CREATE POLICY "Owners can remove members"
  ON public.workspace_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Now fix the workspaces policies to not cause recursion
DROP POLICY IF EXISTS "Users can select member workspaces" ON public.workspaces;

-- This policy was causing the recursion - remove it or simplify it
-- Users can see workspaces they're members of (simplified - no recursion)
CREATE POLICY "Members can see workspaces"
  ON public.workspaces FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.workspace_members
      WHERE workspace_id = workspaces.id
    )
  );

-- Verify policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('workspaces', 'workspace_members')
ORDER BY tablename, policyname;
