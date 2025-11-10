-- =====================================================
-- FIX WORKSPACE MEMBER RLS POLICY
-- Allows workspace owner to add themselves as first member
-- =====================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.workspace_members;

-- Create new policy that allows:
-- 1. Workspace owner to add themselves (when workspace.owner_id = auth.uid() and member.user_id = auth.uid())
-- 2. Existing owners/admins to add other members
CREATE POLICY "Owners and admins can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    -- Allow adding yourself as owner of a workspace you own
    (
      user_id = auth.uid() 
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM public.workspaces w 
        WHERE w.id = workspace_id AND w.owner_id = auth.uid()
      )
    )
    OR
    -- Allow existing owners/admins to add other members
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

COMMENT ON POLICY "Owners and admins can add members" ON public.workspace_members IS 
'Allows workspace owners to add themselves as first member, and allows existing owners/admins to add other members';
