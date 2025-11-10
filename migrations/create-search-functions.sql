-- =====================================================
-- CREATE SEMANTIC SEARCH FUNCTIONS IF MISSING
-- =====================================================

-- Function 1: match_notes (basic semantic search)
CREATE OR REPLACE FUNCTION public.match_notes(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  summary text,
  original_notes text,
  persona text,
  created_at timestamptz,
  similarity float
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
    (1 - (n.embedding <=> query_embedding)) as similarity
  FROM notes n
  WHERE 
    (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding <=> query_embedding)) >= match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function 2: match_notes_by_folder (semantic search filtered by folder)
CREATE OR REPLACE FUNCTION public.match_notes_by_folder(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_folder_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  summary text,
  original_notes text,
  persona text,
  created_at timestamptz,
  similarity float
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
    (1 - (n.embedding <=> query_embedding)) as similarity
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_notes_by_folder TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_notes TO anon;
GRANT EXECUTE ON FUNCTION public.match_notes_by_folder TO anon;

-- Add comments
COMMENT ON FUNCTION public.match_notes IS 'Semantic search across notes using vector similarity';
COMMENT ON FUNCTION public.match_notes_by_folder IS 'Semantic search across notes filtered by folder using vector similarity';

-- Verify functions were created
SELECT 
  'Functions Created' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_name IN ('match_notes', 'match_notes_by_folder')
  AND routine_schema = 'public';
