-- =====================================================
-- FINAL VERIFICATION: Test Everything Works
-- =====================================================

-- 1. Verify workspaces are accessible via API query
SELECT 
  '✅ Workspaces Ready for API' as test,
  w.id,
  w.name,
  wm.role,
  wm.user_id
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
WHERE wm.user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
ORDER BY w.created_at DESC;

-- 2. Test search function with actual "politic" query
WITH politic_embedding AS (
  -- Get embedding from a note about politics
  SELECT embedding::vector as emb
  FROM notes
  WHERE id = 5  -- The politics note
)
SELECT 
  '🔍 Search Test: "politic"' as test,
  n.id,
  LEFT(n.summary, 60) as summary,
  ROUND((1 - (n.embedding::vector <=> pe.emb))::numeric, 3) as similarity
FROM notes n, politic_embedding pe
WHERE n.embedding IS NOT NULL
  AND n.user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
  AND (1 - (n.embedding::vector <=> pe.emb)) >= 0.01  -- Very low threshold
ORDER BY n.embedding::vector <=> pe.emb
LIMIT 10;

-- 3. Verify PDF tables exist
SELECT 
  '✅ PDF Tables' as test,
  table_name,
  CASE 
    WHEN table_name = 'pdfs' THEN 'Main PDF table'
    WHEN table_name = 'pdf_jobs' THEN 'Processing queue'
    WHEN table_name = 'pdf_processing_queue' THEN 'Legacy queue (should exist)'
  END as description
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pdfs', 'pdf_jobs', 'pdf_processing_queue')
ORDER BY table_name;

-- 4. Verify usage_events tracking
SELECT 
  '✅ Usage Events' as test,
  event_type,
  COUNT(*) as event_count,
  MAX(created_at) as last_event
FROM usage_events
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
GROUP BY event_type
ORDER BY event_count DESC;

-- 5. Check RLS policies are permissive
SELECT 
  '✅ RLS Policies Status' as test,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('pdfs', 'pdf_processing_queue', 'usage_events', 'workspaces', 'workspace_members')
ORDER BY tablename, policyname;

-- 6. Verify notes distribution for search testing
SELECT 
  '📊 Notes Distribution' as test,
  CASE 
    WHEN workspace_id IS NULL THEN 'Personal (No workspace)'
    ELSE w.name
  END as location,
  COUNT(*) as note_count,
  COUNT(embedding) as with_embeddings
FROM notes n
LEFT JOIN workspaces w ON w.id = n.workspace_id
WHERE n.user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
GROUP BY workspace_id, w.name
ORDER BY note_count DESC;

-- 7. Final Summary
SELECT 
  '📋 FINAL STATUS' as summary,
  (SELECT COUNT(*) FROM workspaces WHERE owner_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid) as total_workspaces,
  (SELECT COUNT(*) FROM workspace_members WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid) as workspace_memberships,
  (SELECT COUNT(*) FROM notes WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid) as total_notes,
  (SELECT COUNT(*) FROM notes WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid AND embedding IS NOT NULL) as notes_with_embeddings,
  (SELECT COUNT(*) FROM usage_events WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid) as usage_events,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_processing_queue' AND policyname LIKE '%insert%')
    THEN 'PDF Upload: Ready ✅'
    ELSE 'PDF Upload: Needs fix ❌'
  END as pdf_status;
