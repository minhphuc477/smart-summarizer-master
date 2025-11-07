-- Check if user has any data in the database
-- User ID: af5616ae-d19b-47fb-93c2-790f9cc40fd0

SELECT 'notes' as table_name, COUNT(*) as count 
FROM public.notes 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'

UNION ALL

SELECT 'folders', COUNT(*) 
FROM public.folders 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'

UNION ALL

SELECT 'personas', COUNT(*) 
FROM public.personas 
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'

UNION ALL

SELECT 'workspaces', COUNT(*) 
FROM public.workspaces 
WHERE owner_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

-- Test if we can query as this user by temporarily disabling RLS
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';

-- Try to select from folders
SELECT * FROM public.folders WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0';
