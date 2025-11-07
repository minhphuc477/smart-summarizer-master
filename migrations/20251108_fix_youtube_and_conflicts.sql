-- =====================================================
-- Migration: Fix RPC conflicts and YouTube support
-- Date: 2025-11-08
-- =====================================================

-- 1. Drop conflicting auto_categorize_note functions and create single version
DROP FUNCTION IF EXISTS public.auto_categorize_note(p_note_id uuid);
DROP FUNCTION IF EXISTS public.auto_categorize_note(p_note_id bigint);

-- Create single definitive version using BIGINT (matching notes.id type)
CREATE OR REPLACE FUNCTION public.auto_categorize_note(
  p_note_id BIGINT
)
RETURNS TABLE (
  smart_folder_id BIGINT,
  confidence DECIMAL
) AS $$
DECLARE
  v_note RECORD;
  v_folder RECORD;
  v_text TEXT;
  v_tags TEXT[];
  v_keywords TEXT[];
  v_required_tags TEXT[];
  v_match_score DECIMAL;
  v_keyword_matches INTEGER;
  v_tag_matches INTEGER;
  v_total_keywords INTEGER;
BEGIN
  -- Get note details
  SELECT 
    summary, 
    takeaways::text, 
    COALESCE(ARRAY(SELECT unnest(tags)), ARRAY[]::text[]) as note_tags
  INTO v_note
  FROM public.notes
  WHERE id = p_note_id;

  IF v_note IS NULL THEN
    RETURN;
  END IF;

  -- Combine text for matching
  v_text := LOWER(COALESCE(v_note.summary, '') || ' ' || COALESCE(v_note.takeaways, ''));
  v_tags := v_note.note_tags;

  -- Check each smart folder
  FOR v_folder IN 
    SELECT id, conditions
    FROM public.smart_folders
    WHERE is_active = true
  LOOP
    v_match_score := 0;
    v_keywords := COALESCE((v_folder.conditions::jsonb->>'keywords')::text[], ARRAY[]::text[]);
    v_required_tags := COALESCE((v_folder.conditions::jsonb->>'tags')::text[], ARRAY[]::text[]);
    
    -- Count keyword matches
    v_keyword_matches := 0;
    v_total_keywords := COALESCE(array_length(v_keywords, 1), 0);
    
    IF v_total_keywords > 0 THEN
      FOREACH v_keywords IN ARRAY v_keywords
      LOOP
        IF v_text LIKE '%' || LOWER(v_keywords) || '%' THEN
          v_keyword_matches := v_keyword_matches + 1;
        END IF;
      END LOOP;
      v_match_score := v_match_score + (v_keyword_matches::decimal / v_total_keywords) * 0.7;
    END IF;

    -- Count tag matches
    v_tag_matches := 0;
    IF array_length(v_required_tags, 1) > 0 THEN
      v_tag_matches := (
        SELECT COUNT(*)
        FROM unnest(v_tags) AS note_tag
        WHERE note_tag = ANY(v_required_tags)
      );
      v_match_score := v_match_score + (v_tag_matches::decimal / array_length(v_required_tags, 1)) * 0.3;
    END IF;

    -- Return if confidence threshold met
    IF v_match_score >= 0.3 THEN
      smart_folder_id := v_folder.id;
      confidence := v_match_score;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create function to clean up duplicate workspaces
-- (This addresses the duplicate "Personal (Private)" issue)
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_workspaces()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Execute cleanup
SELECT public.cleanup_duplicate_workspaces();

-- 3. Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner_name_unique 
ON public.workspaces(owner_id, name);

COMMENT ON INDEX idx_workspaces_owner_name_unique IS 
'Prevents duplicate workspace names per user';

-- 4. Create public.users view for easier querying (maps to auth.users)
-- This allows PostgREST foreign key relationships to work properly
CREATE OR REPLACE VIEW public.users AS
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users;

COMMENT ON VIEW public.users IS 
'Public view of auth.users for foreign key relationships and easier querying';

-- Grant SELECT permission on the view
GRANT SELECT ON public.users TO authenticated, anon;
