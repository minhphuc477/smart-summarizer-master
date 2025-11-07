-- Fix folder_stats view to work with RLS
-- Views need explicit grants or security_invoker to respect RLS

-- Drop and recreate folder_stats view with security_invoker
DROP VIEW IF EXISTS public.folder_stats;

CREATE VIEW public.folder_stats
WITH (security_invoker = true)
AS
SELECT 
  f.id,
  f.name,
  f.description,
  f.color,
  f.user_id,
  f.workspace_id,
  f.created_at,
  f.updated_at,
  COUNT(DISTINCT n.id) AS note_count,
  COALESCE(SUM(LENGTH(n.original_notes)), 0) AS total_size
FROM public.folders f
LEFT JOIN public.notes n ON n.folder_id = f.id
GROUP BY f.id, f.name, f.description, f.color, f.user_id, f.workspace_id, f.created_at, f.updated_at;

-- Grant access to authenticated users
GRANT SELECT ON public.folder_stats TO authenticated;

-- Verify the view
SELECT * FROM folder_stats LIMIT 1;

-- Check folder table policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'folders';
