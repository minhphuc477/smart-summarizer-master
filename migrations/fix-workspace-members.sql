-- Fix workspace membership for existing workspaces
-- Run this AFTER fix-dimension-and-canvas-versions.sql

-- =====================================================
-- 1. Backfill workspace_members for existing workspaces
-- =====================================================

-- Add owner as member for any workspaces without membership entries
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT 
  w.id,
  w.owner_id,
  'owner'::text
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm 
  WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Verify workspace memberships
SELECT 
  w.id,
  w.name,
  w.owner_id,
  COUNT(wm.user_id) as member_count,
  BOOL_OR(wm.user_id = w.owner_id AND wm.role = 'owner') as owner_is_member
FROM public.workspaces w
LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
GROUP BY w.id, w.name, w.owner_id
ORDER BY w.created_at DESC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Workspace members backfilled successfully!';
  RAISE NOTICE 'All workspace owners now have membership entries.';
END $$;
