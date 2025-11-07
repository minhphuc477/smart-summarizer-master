-- Check if folder_stats view exists and test access
SELECT 
    schemaname,
    viewname,
    viewowner
FROM pg_views
WHERE schemaname = 'public' 
AND viewname LIKE '%folder%';

-- Try to query it
SELECT COUNT(*) FROM public.folder_stats;

-- Drop and recreate the view (fixes column mismatch issues)
DROP VIEW IF EXISTS public.folder_stats;

CREATE VIEW public.folder_stats AS
SELECT 
    f.id,
    f.user_id,
    f.name,
    f.description,
    f.color,
    f.created_at,
    f.updated_at,
    COALESCE(COUNT(n.id), 0) as note_count
FROM public.folders f
LEFT JOIN public.notes n ON n.folder_id = f.id
GROUP BY f.id, f.user_id, f.name, f.description, f.color, f.created_at, f.updated_at;

-- Grant access to authenticated users (needed for RLS)
GRANT SELECT ON public.folder_stats TO authenticated;

-- Test the view
SELECT * FROM public.folder_stats LIMIT 5;
