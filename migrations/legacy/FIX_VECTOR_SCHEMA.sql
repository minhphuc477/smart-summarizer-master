-- =====================================================
-- FIX: Vector Schema Issue
-- =====================================================
-- Problem: vector type is in extensions.vector, not public.vector
-- Solution: Use explicit schema qualification and type casting

-- Drop old functions
DROP FUNCTION IF EXISTS public.match_notes(vector, double precision, integer, uuid);
DROP FUNCTION IF EXISTS public.match_notes_by_folder(vector, double precision, integer, uuid, bigint);
DROP FUNCTION IF EXISTS public.match_notes(extensions.vector, double precision, integer, uuid);
DROP FUNCTION IF EXISTS public.match_notes_by_folder(extensions.vector, double precision, integer, uuid, bigint);

-- Create match_notes with proper vector type handling
CREATE OR REPLACE FUNCTION public.match_notes(
  query_embedding vector(384),
  match_threshold double precision DEFAULT 0.78,
  match_count integer DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  summary text,
  original_notes text,
  persona text,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.summary,
    n.original_notes,
    n.persona,
    n.created_at,
    (1 - (n.embedding::vector <=> query_embedding::vector))::double precision as similarity
  FROM notes n
  WHERE 
    (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding::vector <=> query_embedding::vector)) >= match_threshold
  ORDER BY n.embedding::vector <=> query_embedding::vector
  LIMIT match_count;
END;
$$;

-- Create match_notes_by_folder with proper vector type handling
CREATE OR REPLACE FUNCTION public.match_notes_by_folder(
  query_embedding vector(384),
  match_threshold double precision DEFAULT 0.78,
  match_count integer DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_folder_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  summary text,
  original_notes text,
  persona text,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.summary,
    n.original_notes,
    n.persona,
    n.created_at,
    (1 - (n.embedding::vector <=> query_embedding::vector))::double precision as similarity
  FROM notes n
  WHERE 
    (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND (filter_folder_id IS NULL OR n.folder_id = filter_folder_id)
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding::vector <=> query_embedding::vector)) >= match_threshold
  ORDER BY n.embedding::vector <=> query_embedding::vector
  LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.match_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_notes_by_folder TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_notes TO anon;
GRANT EXECUTE ON FUNCTION public.match_notes_by_folder TO anon;

-- Verification
SELECT 
  '✅ Functions Fixed' as status,
  routine_name as function_name
FROM information_schema.routines
WHERE routine_name IN ('match_notes', 'match_notes_by_folder')
  AND routine_schema = 'public';

-- Quick test
WITH sample_note AS (
  SELECT embedding::vector as emb
  FROM notes 
  WHERE embedding IS NOT NULL 
  LIMIT 1
)
SELECT 
  '🧪 Test Results' as test_section,
  id,
  LEFT(summary, 60) as summary_preview,
  ROUND(similarity::numeric, 3) as score
FROM match_notes(
  (SELECT emb FROM sample_note),
  0.5,
  5,
  NULL
)
ORDER BY similarity DESC;
