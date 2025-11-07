-- Patch: Fix get_user_workspaces function to use correct timestamp columns
-- Date: 2025-11-06
-- Issue: Function was referencing wm.created_at and wm.updated_at which don't exist
-- Fix: Use w.created_at and w.updated_at from workspaces table instead

CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_description TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.description as workspace_description,
    wm.role,
    w.created_at,     -- Changed from wm.created_at
    w.updated_at      -- Changed from wm.updated_at
  FROM workspaces w
  INNER JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid();
END;
$$;
