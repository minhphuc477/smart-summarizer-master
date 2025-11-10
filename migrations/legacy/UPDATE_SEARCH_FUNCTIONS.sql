-- =====================================================
-- OPTIMIZED FIX: Update Search Functions Only
-- =====================================================
-- Your diagnosis shows:
-- ✅ Functions exist but have suboptimal defaults (0.5 threshold, returns integer)
-- ✅ RLS policy already fixed
-- ✅ Vector extension installed
-- ✅ All notes have embeddings
--
-- This script ONLY updates the search functions to better defaults

-- Drop old functions with old signature
DROP FUNCTION IF EXISTS public.match_notes(vector, double precision, integer, uuid);
DROP FUNCTION IF EXISTS public.match_notes_by_folder(vector, double precision, integer, uuid, integer);

-- Create improved match_notes function
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.summary,
    n.original_notes,
    n.persona,
    n.created_at,
    (1 - (n.embedding <=> query_embedding))::double precision as similarity
  FROM notes n
  WHERE 
    (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding <=> query_embedding)) >= match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create improved match_notes_by_folder function
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.summary,
    n.original_notes,
    n.persona,
    n.created_at,
    (1 - (n.embedding <=> query_embedding))::double precision as similarity
  FROM notes n
  WHERE 
    (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND (filter_folder_id IS NULL OR n.folder_id = filter_folder_id)
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding <=> query_embedding)) >= match_threshold
  ORDER BY n.embedding <=> query_embedding
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
  '✅ Functions Updated' as status,
  routine_name,
  'Threshold: 0.78, Count: 10, Returns: bigint' as improvements
FROM information_schema.routines
WHERE routine_name IN ('match_notes', 'match_notes_by_folder')
  AND routine_schema = 'public';

-- Test query (replace with your actual user_id)
DO $$
DECLARE
  test_embedding vector(384);
BEGIN
  -- Get an embedding from an existing note
  SELECT embedding INTO test_embedding 
  FROM notes 
  WHERE embedding IS NOT NULL 
  LIMIT 1;
  
  -- Test the function
  RAISE NOTICE '🧪 Testing search function...';
  PERFORM * FROM match_notes(test_embedding, 0.78, 5, NULL);
  RAISE NOTICE '✅ Search function works!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
END $$;
