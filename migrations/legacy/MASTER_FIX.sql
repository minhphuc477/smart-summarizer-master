-- =====================================================
-- MASTER FIX SCRIPT - RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================

-- PART 1: FIX WORKSPACE CREATION
-- =====================================================
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.workspace_members;

CREATE POLICY "Owners and admins can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() AND role = 'owner' AND EXISTS (
      SELECT 1 FROM public.workspaces w 
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    ))
    OR
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- PART 2: CREATE SEMANTIC SEARCH FUNCTIONS
-- =====================================================

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS public.match_notes(vector, float, int, uuid);
DROP FUNCTION IF EXISTS public.match_notes_by_folder(vector, float, int, uuid, bigint);

-- Create match_notes function
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

-- Create match_notes_by_folder function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.match_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_notes_by_folder TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_notes TO anon;
GRANT EXECUTE ON FUNCTION public.match_notes_by_folder TO anon;

-- PART 3: VERIFICATION QUERIES
-- =====================================================

-- Verify functions exist
SELECT 
  'Search Functions Status' as check_type,
  routine_name,
  'Created' as status
FROM information_schema.routines
WHERE routine_name IN ('match_notes', 'match_notes_by_folder')
  AND routine_schema = 'public';

-- Check workspaces
SELECT 
  'Workspaces Count' as check_type,
  COUNT(*) as total
FROM workspaces;

-- Check notes with embeddings
SELECT 
  'Notes with Embeddings' as check_type,
  COUNT(*) as total_notes,
  COUNT(embedding) as with_embeddings
FROM notes;

-- Success message
SELECT '✅ All fixes applied successfully! You can now:
1. Create workspaces without RLS errors
2. Use semantic search with the match_notes functions
3. Test with search query: "financial planning discussion"' as success_message;
