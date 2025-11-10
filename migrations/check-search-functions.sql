-- Check if semantic search functions exist
SELECT 
  'Semantic Search Functions' as check_name,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE 'match_notes%'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- If they exist, check their signatures
SELECT 
  'Function Details' as check_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE 'match_notes%'
ORDER BY p.proname;
