-- Migration: Add folder-scoped semantic search RPC
-- Run this in Supabase SQL Editor after running supabase-migration-semantic-search.sql

-- Create RPC function that supports optional folder filter and returns folder_id
CREATE OR REPLACE FUNCTION match_notes_by_folder (
  query_embedding vector(384),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL,
  filter_folder_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  summary text,
  original_notes text,
  persona text,
  created_at timestamptz,
  folder_id bigint,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id,
    n.summary,
    n.original_notes,
    n.persona,
    n.created_at,
    n.folder_id,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM notes AS n
  WHERE 
    n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND (filter_folder_id IS NULL OR n.folder_id = filter_folder_id)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION match_notes_by_folder IS 'Semantic search on notes with optional folder filter and folder_id in results';
