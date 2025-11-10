-- =====================================================
-- DEBUG: Why is search returning no results?
-- =====================================================

-- 1. Check all notes and their embeddings
SELECT 
  '📝 All Notes' as section,
  id,
  user_id,
  LEFT(summary, 60) as summary_preview,
  LEFT(original_notes, 60) as original_preview,
  CASE 
    WHEN embedding IS NOT NULL THEN 'Has embedding'
    ELSE 'NO EMBEDDING'
  END as embedding_status,
  created_at
FROM notes
ORDER BY created_at DESC;

-- 2. Test search with sample embedding (should return notes)
WITH sample AS (
  SELECT embedding::vector as emb, id as sample_id
  FROM notes 
  WHERE embedding IS NOT NULL 
  LIMIT 1
)
SELECT 
  '🔍 Test: Search with sample embedding' as section,
  n.id,
  LEFT(n.summary, 60) as summary_preview,
  ROUND((1 - (n.embedding::vector <=> s.emb))::numeric, 3) as similarity
FROM notes n, sample s
WHERE n.embedding IS NOT NULL
  AND (1 - (n.embedding::vector <=> s.emb)) >= 0.5
ORDER BY n.embedding::vector <=> s.emb
LIMIT 10;

-- 3. Check if match_notes function works directly
WITH sample AS (
  SELECT embedding::vector as emb
  FROM notes 
  WHERE embedding IS NOT NULL 
  LIMIT 1
)
SELECT 
  '🔍 Test: match_notes function' as section,
  id,
  LEFT(summary, 60) as summary_preview,
  ROUND(similarity::numeric, 3) as similarity_score
FROM sample, match_notes(sample.emb, 0.5, 10, NULL)
ORDER BY similarity DESC;

-- 4. Check for specific user
SELECT 
  '👤 Notes by User' as section,
  user_id,
  COUNT(*) as note_count,
  COUNT(embedding) as with_embeddings,
  ROUND((COUNT(embedding)::numeric / COUNT(*)::numeric * 100), 1) as embedding_percentage
FROM notes
GROUP BY user_id;

-- 5. Check if there are any workspace/folder filters blocking
SELECT 
  '📁 Workspace/Folder Distribution' as section,
  workspace_id,
  folder_id,
  COUNT(*) as note_count
FROM notes
GROUP BY workspace_id, folder_id
ORDER BY note_count DESC;
