-- Migration: Fix remaining search_path vulnerabilities
-- Date: 2025-11-10
-- Description: Add SET search_path = '' to functions that were created after the main fix
-- Lint Rule: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- This migration fixes the remaining functions flagged by the Supabase linter.
-- All functions need SECURITY DEFINER + SET search_path = '' to prevent search_path attacks.

-- 1. set_embedding_jobs_updated_at (from 20251108_embedding_queue.sql)
DROP FUNCTION IF EXISTS public.set_embedding_jobs_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.set_embedding_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'embedding_jobs') THEN
    DROP TRIGGER IF EXISTS trg_embedding_jobs_updated_at ON public.embedding_jobs;
    CREATE TRIGGER trg_embedding_jobs_updated_at
      BEFORE UPDATE ON public.embedding_jobs
      FOR EACH ROW 
      EXECUTE FUNCTION public.set_embedding_jobs_updated_at();
  END IF;
END;
$$;

-- 2. cleanup_duplicate_workspaces (from 20251108_fix_youtube_and_conflicts.sql)
DROP FUNCTION IF EXISTS public.cleanup_duplicate_workspaces() CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_workspaces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user RECORD;
  v_workspace RECORD;
  v_keep_id UUID;
  v_duplicate_ids UUID[];
BEGIN
  -- For each user, find duplicate workspace names
  FOR v_user IN 
    SELECT DISTINCT owner_id 
    FROM public.workspaces
  LOOP
    -- Find duplicate workspace names for this user
    FOR v_workspace IN
      SELECT name, COUNT(*) as cnt
      FROM public.workspaces
      WHERE owner_id = v_user.owner_id
      GROUP BY name
      HAVING COUNT(*) > 1
    LOOP
      -- Keep the oldest workspace, delete the rest
      SELECT id INTO v_keep_id
      FROM public.workspaces
      WHERE owner_id = v_user.owner_id 
        AND name = v_workspace.name
      ORDER BY created_at ASC
      LIMIT 1;

      -- Get IDs of duplicates to delete
      SELECT ARRAY_AGG(id) INTO v_duplicate_ids
      FROM public.workspaces
      WHERE owner_id = v_user.owner_id
        AND name = v_workspace.name
        AND id != v_keep_id;

      -- Reassign notes and folders to the kept workspace
      UPDATE public.notes
      SET workspace_id = v_keep_id
      WHERE workspace_id = ANY(v_duplicate_ids);

      UPDATE public.folders
      SET workspace_id = v_keep_id
      WHERE workspace_id = ANY(v_duplicate_ids);

      -- Delete duplicate workspaces
      DELETE FROM public.workspaces
      WHERE id = ANY(v_duplicate_ids);

      RAISE NOTICE 'Merged % duplicate workspaces named "%" for user %', 
        array_length(v_duplicate_ids, 1), v_workspace.name, v_user.owner_id;
    END LOOP;
  END LOOP;
END;
$$;

-- 3. notes_embedding_validate_trigger
-- This trigger function validates embedding dimensions
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
    IF array_length(NEW.embedding::float[]::float4[], 1) != 384 THEN
      RAISE EXCEPTION 'Embedding dimension mismatch: expected 384, got %', 
        array_length(NEW.embedding::float[]::float4[], 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger if it exists
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

-- 4. vector_dims helper function
DROP FUNCTION IF EXISTS public.vector_dims(vector) CASCADE;
CREATE OR REPLACE FUNCTION public.vector_dims(v vector)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
IMMUTABLE
AS $$
BEGIN
  RETURN array_length(v::float[]::float4[], 1);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_embedding_jobs_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_duplicate_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notes_embedding_validate_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vector_dims(vector) TO authenticated, anon;

-- Add comments for documentation
COMMENT ON FUNCTION public.set_embedding_jobs_updated_at() IS 
'Trigger function to update updated_at timestamp on embedding_jobs - SECURITY: search_path immutable';

COMMENT ON FUNCTION public.cleanup_duplicate_workspaces() IS 
'Merges duplicate workspaces for each user, keeping the oldest - SECURITY: search_path immutable';

COMMENT ON FUNCTION public.notes_embedding_validate_trigger() IS 
'Validates embedding dimension is 384 before insert/update - SECURITY: search_path immutable';

COMMENT ON FUNCTION public.vector_dims(vector) IS 
'Returns the dimension of a vector - SECURITY: search_path immutable';

