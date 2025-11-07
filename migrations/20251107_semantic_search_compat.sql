-- Migration: Semantic search functions using inner product (<#>) as cosine similarity (embeddings pre-normalized)
-- IMPORTANT: pgvector inner product returns higher = more similar. We filter by threshold on raw score.
-- Ensure an index exists: CREATE INDEX IF NOT EXISTS idx_notes_embedding ON public.notes USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
-- (Use vector_ip_ops if you remove normalization.)
CREATE OR REPLACE FUNCTION public.match_notes(
  query_embedding vector(384),
  match_threshold double precision DEFAULT 0.78,
  match_count integer DEFAULT 5,
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
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id,
    n.summary,
    n.original_notes,
    n.persona,
    n.created_at,
  (n.embedding <#> query_embedding) AS similarity
  FROM public.notes n
  WHERE 
    n.embedding IS NOT NULL
  AND (n.embedding <#> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR n.user_id = filter_user_id)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_notes_by_folder(
  query_embedding vector(384),
  match_threshold double precision DEFAULT 0.78,
  match_count integer DEFAULT 5,
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
  similarity double precision
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
  (n.embedding <#> query_embedding) AS similarity
  FROM public.notes n
  WHERE 
    n.embedding IS NOT NULL
    AND (filter_folder_id IS NULL OR n.folder_id = filter_folder_id)
    AND (filter_user_id IS NULL OR n.user_id = filter_user_id)
  AND (n.embedding <#> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
