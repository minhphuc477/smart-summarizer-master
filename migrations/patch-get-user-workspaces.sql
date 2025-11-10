-- Patch: Fix get_user_workspaces function to use correct timestamp columns
-- Date: 2025-11-06
-- Issue: Function was referencing wm.created_at and wm.updated_at which don't exist
-- Fix: Use w.created_at and w.updated_at from workspaces table instead
-- Update: Added member_count, note_count, folder_count to return workspace statistics

CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_description TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  member_count BIGINT,
  note_count BIGINT,
  folder_count BIGINT
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
    w.updated_at,     -- Changed from wm.updated_at
    -- Count members in this workspace
    (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id) as member_count,
    -- Count notes in this workspace
    (SELECT COUNT(*) FROM notes n WHERE n.workspace_id = w.id) as note_count,
    -- Count folders in this workspace
    (SELECT COUNT(*) FROM folders f WHERE f.workspace_id = w.id) as folder_count
  FROM workspaces w
  INNER JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid();
END;
$$;
