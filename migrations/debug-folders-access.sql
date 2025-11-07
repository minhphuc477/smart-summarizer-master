-- Debug script to check why folders access is failing
-- Run this as your authenticated user

-- 1. Check your user ID
SELECT auth.uid() as my_user_id;

-- 2. Check if you have any folders
SELECT id, user_id, name, workspace_id 
FROM public.folders 
WHERE user_id = auth.uid()
LIMIT 5;

-- 3. Check all RLS policies on folders table
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
WHERE schemaname = 'public' 
AND tablename = 'folders'
ORDER BY policyname;

-- 4. Test if folder_stats view works
SELECT * FROM public.folder_stats WHERE user_id = auth.uid() LIMIT 5;

-- 5. Check if RLS is enabled on folders
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'folders';

-- 6. Try a direct select on folders (bypass view)
SELECT COUNT(*) as my_folder_count 
FROM public.folders 
WHERE user_id = auth.uid();
