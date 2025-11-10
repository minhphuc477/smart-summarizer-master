-- =====================================================
-- TEST SEMANTIC SEARCH - See Actual Results
-- =====================================================
-- The UPDATE_SEARCH_FUNCTIONS.sql worked! Functions are updated.
-- Now let's test them and SEE the actual search results.

-- Test 1: Get a sample embedding from your notes
WITH sample_note AS (
  SELECT 
    id,
    LEFT(summary, 50) as summary_preview,
    embedding
  FROM notes 
  WHERE embedding IS NOT NULL 
    AND user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
  LIMIT 1
)
SELECT 
  '📝 Sample Note Used for Test' as test_section,
  id,
  summary_preview
FROM sample_note;

-- Test 2: Search using that embedding (should find similar notes)
WITH sample_note AS (
  SELECT embedding
  FROM notes 
  WHERE embedding IS NOT NULL 
    AND user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
  LIMIT 1
)
SELECT 
  '🔍 Search Results (Using match_notes function)' as test_section,
  id,
  LEFT(summary, 60) as summary_preview,
  LEFT(original_notes, 60) as original_preview,
  persona,
  ROUND(similarity::numeric, 3) as similarity_score
FROM match_notes(
  (SELECT embedding FROM sample_note),
  0.78,  -- threshold
  5,     -- max results
  'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid  -- your user_id
)
ORDER BY similarity DESC;

-- Test 3: Lower threshold to see more results
WITH sample_note AS (
  SELECT embedding
  FROM notes 
  WHERE embedding IS NOT NULL 
    AND user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
  LIMIT 1
)
SELECT 
  '🔍 Search Results (Lower threshold 0.5 for more results)' as test_section,
  id,
  LEFT(summary, 60) as summary_preview,
  ROUND(similarity::numeric, 3) as similarity_score
FROM match_notes(
  (SELECT embedding FROM sample_note),
  0.5,   -- lower threshold = more results
  10,    -- max results
  'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
)
ORDER BY similarity DESC;

-- Test 4: Show all your notes for comparison
SELECT 
  '📚 All Your Notes (for reference)' as test_section,
  id,
  LEFT(summary, 60) as summary_preview,
  CASE 
    WHEN embedding IS NOT NULL THEN '✅ Has embedding'
    ELSE '❌ No embedding'
  END as embedding_status,
  created_at
FROM notes
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
ORDER BY created_at DESC;

-- Test 5: Verify function signatures
SELECT 
  '✅ Function Verification' as test_section,
  routine_name,
  CASE 
    WHEN routine_definition LIKE '%0.78%' THEN '✅ Updated (threshold 0.78)'
    WHEN routine_definition LIKE '%0.5%' THEN '⚠️ Old (threshold 0.5)'
    ELSE '❓ Unknown'
  END as version_status
FROM information_schema.routines
WHERE routine_name IN ('match_notes', 'match_notes_by_folder')
  AND routine_schema = 'public';
