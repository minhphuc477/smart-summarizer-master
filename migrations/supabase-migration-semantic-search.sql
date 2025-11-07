-- Migration: Enable pgvector and add embedding column for Semantic Search
-- Run this in Supabase SQL Editor

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to notes table
-- Using 384 dimensions (all-MiniLM-L6-v2 model from Transformers.js)
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Step 3: Create an index for faster vector similarity searches
-- Using ivfflat index (good balance between speed and accuracy)
CREATE INDEX IF NOT EXISTS notes_embedding_idx 
ON public.notes 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Create RPC function for semantic search
CREATE OR REPLACE FUNCTION match_notes (
  query_embedding vector(384),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 5,
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
LANGUAGE sql STABLE
AS $$
  SELECT
    notes.id,
    notes.summary,
    notes.original_notes,
    notes.persona,
    notes.created_at,
    1 - (notes.embedding <=> query_embedding) AS similarity
  FROM notes
  WHERE 
    notes.embedding IS NOT NULL
    AND 1 - (notes.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR notes.user_id = filter_user_id)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Step 5: Add comment for documentation
COMMENT ON COLUMN notes.embedding IS 'Vector embedding (384-dim) for semantic search using all-MiniLM-L6-v2 (Transformers.js)';
COMMENT ON FUNCTION match_notes IS 'Performs semantic search on notes using cosine similarity';
