-- =====================================================
-- VERIFY: Politics note location
-- =====================================================

-- Find the politics note
SELECT 
  '🔍 Politics Note Details' as section,
  id,
  user_id,
  summary,
  LEFT(original_notes, 100) as original_preview,
  workspace_id,
  folder_id,
  created_at
FROM notes
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
  AND (summary ILIKE '%politic%' OR original_notes ILIKE '%politic%')
ORDER BY created_at DESC;

-- Test semantic search for "politic" with NO folder filter
WITH test_query AS (
  -- Generate embedding for "politic"
  SELECT n.embedding::vector as query_emb
  FROM notes n
  WHERE n.id = 5 -- The politics note
)
SELECT 
  '🔍 Semantic Search: "politic" (NO folder filter)' as section,
  id,
  LEFT(summary, 60) as summary_preview,
  workspace_id,
  folder_id,
  ROUND(similarity::numeric, 3) as score
FROM test_query, match_notes(
  test_query.query_emb,
  0.3,  -- Low threshold
  10,
  'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
)
ORDER BY similarity DESC;

-- Show all notes grouped by location
SELECT 
  '📁 Notes by Location' as section,
  COALESCE(workspace_id::text, 'No workspace') as workspace,
  COALESCE(folder_id::text, 'No folder') as folder,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at DESC) as note_ids,
  array_agg(LEFT(summary, 30) ORDER BY created_at DESC) as summaries
FROM notes
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
GROUP BY workspace_id, folder_id
ORDER BY count DESC;
