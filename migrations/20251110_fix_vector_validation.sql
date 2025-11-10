-- Fix vector dimension validation for pgvector compatibility
-- Run this in Supabase SQL Editor

-- Fix the vector_dims function to work with pgvector vector type
DROP FUNCTION IF EXISTS public.vector_dims(vector) CASCADE;
CREATE OR REPLACE FUNCTION public.vector_dims(v vector)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
IMMUTABLE
AS $$
DECLARE
  dims integer;
BEGIN
  -- Extract dimension from vector string representation
  -- Vector format is like '[0.1,0.2,...]'
  SELECT array_length(string_to_array(trim(both '[]' from v::text), ','), 1) INTO dims;
  RETURN dims;
END;
$$;

-- Fix the trigger function to work with vector types
DROP FUNCTION IF EXISTS public.notes_embedding_validate_trigger() CASCADE;
CREATE OR REPLACE FUNCTION public.notes_embedding_validate_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate that embedding has the correct dimension (384)
  IF NEW.embedding IS NOT NULL THEN
    -- For vector type, use vector_dims function
    IF public.vector_dims(NEW.embedding) != 384 THEN
      RAISE EXCEPTION 'Embedding dimension mismatch: expected 384, got %',
        public.vector_dims(NEW.embedding);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN
    DROP TRIGGER IF EXISTS notes_embedding_validate ON public.notes;
    CREATE TRIGGER notes_embedding_validate
      BEFORE INSERT OR UPDATE OF embedding ON public.notes
      FOR EACH ROW
      WHEN (NEW.embedding IS NOT NULL)
      EXECUTE FUNCTION public.notes_embedding_validate_trigger();
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.vector_dims(vector) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notes_embedding_validate_trigger() TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.vector_dims(vector) IS 'Returns the dimension (length) of a pgvector vector';
COMMENT ON FUNCTION public.notes_embedding_validate_trigger() IS 'Validates that note embeddings have the correct dimension (384)';