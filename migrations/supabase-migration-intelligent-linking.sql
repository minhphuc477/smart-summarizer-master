-- =====================================================
-- Migration: Intelligent Note Linking & Smart Folders
-- =====================================================
-- Features:
-- 1. Auto-link related notes using semantic similarity
-- 2. Smart folders that auto-categorize based on topics
-- 3. Bidirectional note relationships
-- 4. Topic-based auto-categorization rules
-- =====================================================

-- =====================================================
-- 1. NOTE LINKS TABLE
-- =====================================================
-- Tracks bidirectional relationships between notes
CREATE TABLE IF NOT EXISTS public.note_links (
  id BIGSERIAL PRIMARY KEY,
  source_note_id BIGINT NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  target_note_id BIGINT NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4), -- Semantic similarity (0.0000-1.0000)
  link_type TEXT NOT NULL DEFAULT 'related', -- 'related', 'manual', 'reference'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'system', -- 'system' or 'user'
  
  -- Prevent duplicate links
  CONSTRAINT unique_note_link UNIQUE (source_note_id, target_note_id),
  -- Prevent self-linking
  CONSTRAINT no_self_link CHECK (source_note_id != target_note_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_note_links_source ON public.note_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target ON public.note_links(target_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_user ON public.note_links(user_id);
CREATE INDEX IF NOT EXISTS idx_note_links_similarity ON public.note_links(similarity_score DESC);

-- RLS policies
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own note links"
  ON public.note_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own note links"
  ON public.note_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note links"
  ON public.note_links FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. SMART FOLDERS TABLE
-- =====================================================
-- Folders that auto-categorize notes based on rules
CREATE TABLE IF NOT EXISTS public.smart_folders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🤖',
  color TEXT DEFAULT '#3b82f6',
  
  -- Auto-categorization rules
  rules JSONB NOT NULL DEFAULT '{}', -- { "keywords": [], "tags": [], "min_similarity": 0.75 }
  auto_assign BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  note_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_smart_folder_name UNIQUE (user_id, workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_smart_folders_user ON public.smart_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_folders_workspace ON public.smart_folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_smart_folders_auto_assign ON public.smart_folders(auto_assign) WHERE auto_assign = TRUE;

-- RLS policies
ALTER TABLE public.smart_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smart folders"
  ON public.smart_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own smart folders"
  ON public.smart_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smart folders"
  ON public.smart_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smart folders"
  ON public.smart_folders FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 3. SMART FOLDER ASSIGNMENTS TABLE
-- =====================================================
-- Many-to-many: notes can be in multiple smart folders
CREATE TABLE IF NOT EXISTS public.smart_folder_assignments (
  id BIGSERIAL PRIMARY KEY,
  smart_folder_id BIGINT NOT NULL REFERENCES public.smart_folders(id) ON DELETE CASCADE,
  note_id BIGINT NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confidence_score DECIMAL(5,4), -- How well the note matches folder rules (0.0000-1.0000)
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT DEFAULT 'system', -- 'system' or 'user'
  
  CONSTRAINT unique_smart_folder_assignment UNIQUE (smart_folder_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_smart_folder_assignments_folder ON public.smart_folder_assignments(smart_folder_id);
CREATE INDEX IF NOT EXISTS idx_smart_folder_assignments_note ON public.smart_folder_assignments(note_id);
CREATE INDEX IF NOT EXISTS idx_smart_folder_assignments_user ON public.smart_folder_assignments(user_id);

-- RLS policies
ALTER TABLE public.smart_folder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smart folder assignments"
  ON public.smart_folder_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own smart folder assignments"
  ON public.smart_folder_assignments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smart folder assignments"
  ON public.smart_folder_assignments FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. FUNCTION: Auto-discover and link related notes
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_link_related_notes(
  p_note_id BIGINT,
  p_min_similarity DECIMAL DEFAULT 0.78,
  p_max_links INTEGER DEFAULT 5
)
RETURNS TABLE (
  linked_note_id BIGINT,
  similarity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH note_info AS (
    SELECT id, user_id, embedding
    FROM public.notes
    WHERE id = p_note_id AND embedding IS NOT NULL
  ),
  similar_notes AS (
    SELECT 
      n.id,
      n.user_id,
      1 - (n.embedding <=> ni.embedding) as similarity
    FROM public.notes n
    CROSS JOIN note_info ni
    WHERE n.id != p_note_id
      AND n.user_id = ni.user_id
      AND n.embedding IS NOT NULL
      AND 1 - (n.embedding <=> ni.embedding) >= p_min_similarity
    ORDER BY similarity DESC
    LIMIT p_max_links
  )
  INSERT INTO public.note_links (source_note_id, target_note_id, user_id, similarity_score, link_type, created_by)
  SELECT 
    p_note_id,
    sn.id,
    sn.user_id,
    sn.similarity,
    'related',
    'system'
  FROM similar_notes sn
  ON CONFLICT (source_note_id, target_note_id) DO NOTHING
  RETURNING target_note_id AS linked_note_id, similarity_score AS similarity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. FUNCTION: Auto-categorize note into smart folders
-- =====================================================
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
BEGIN
  -- Get note details
  SELECT n.id, n.user_id, n.summary, n.original_notes, n.workspace_id,
         COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as note_tags
  INTO v_note
  FROM public.notes n
  LEFT JOIN public.note_tags nt ON nt.note_id = n.id
  LEFT JOIN public.tags t ON t.id = nt.tag_id
  WHERE n.id = p_note_id
  GROUP BY n.id, n.user_id, n.summary, n.original_notes, n.workspace_id;
  
  IF v_note.id IS NULL THEN
    RETURN;
  END IF;
  
  -- Combine text for matching
  v_text := LOWER(COALESCE(v_note.summary, '') || ' ' || COALESCE(v_note.original_notes, ''));
  v_tags := v_note.note_tags;
  
  -- Check each auto-assign smart folder
  FOR v_folder IN 
    SELECT sf.id, sf.rules, sf.workspace_id
    FROM public.smart_folders sf
    WHERE sf.user_id = v_note.user_id
      AND sf.auto_assign = TRUE
      AND (sf.workspace_id IS NULL OR sf.workspace_id = v_note.workspace_id)
  LOOP
    v_match_score := 0.0;
    v_keyword_matches := 0;
    v_tag_matches := 0;
    
    -- Extract rules
    v_keywords := COALESCE(
      (SELECT array_agg(LOWER(value::text))
       FROM jsonb_array_elements_text(v_folder.rules->'keywords')), 
      '{}'
    );
    
    v_required_tags := COALESCE(
      (SELECT array_agg(LOWER(value::text))
       FROM jsonb_array_elements_text(v_folder.rules->'tags')), 
      '{}'
    );
    
    -- Count keyword matches
    IF array_length(v_keywords, 1) > 0 THEN
      SELECT COUNT(*)
      INTO v_keyword_matches
      FROM unnest(v_keywords) kw
      WHERE v_text LIKE '%' || kw || '%';
      
      v_match_score := v_match_score + (v_keyword_matches::DECIMAL / array_length(v_keywords, 1) * 0.6);
    END IF;
    
    -- Count tag matches
    IF array_length(v_required_tags, 1) > 0 THEN
      SELECT COUNT(*)
      INTO v_tag_matches
      FROM unnest(v_required_tags) rt
      WHERE EXISTS (
        SELECT 1 FROM unnest(v_tags) nt WHERE LOWER(nt) = rt
      );
      
      v_match_score := v_match_score + (v_tag_matches::DECIMAL / array_length(v_required_tags, 1) * 0.4);
    END IF;
    
    -- If no rules, skip
    IF array_length(v_keywords, 1) IS NULL AND array_length(v_required_tags, 1) IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Check minimum similarity threshold
    IF v_match_score >= COALESCE((v_folder.rules->>'min_similarity')::DECIMAL, 0.5) THEN
      -- Insert assignment
      INSERT INTO public.smart_folder_assignments (smart_folder_id, note_id, user_id, confidence_score, assigned_by)
      VALUES (v_folder.id, p_note_id, v_note.user_id, v_match_score, 'system')
      ON CONFLICT (smart_folder_id, note_id) DO UPDATE
        SET confidence_score = EXCLUDED.confidence_score,
            assigned_at = NOW();
      
      -- Update folder note count
      UPDATE public.smart_folders
      SET note_count = (
        SELECT COUNT(*) FROM public.smart_folder_assignments
        WHERE smart_folder_id = v_folder.id
      ),
      updated_at = NOW()
      WHERE id = v_folder.id;
      
      RETURN QUERY SELECT v_folder.id, v_match_score;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. TRIGGER: Auto-categorize on note update
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_auto_categorize_note()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run if summary or original_notes changed
  IF TG_OP = 'INSERT' OR 
     (TG_OP = 'UPDATE' AND (OLD.summary IS DISTINCT FROM NEW.summary OR OLD.original_notes IS DISTINCT FROM NEW.original_notes)) THEN
    
    -- Run async (fire-and-forget style categorization)
    PERFORM public.auto_categorize_note(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_categorize_note_trigger
  AFTER INSERT OR UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_categorize_note();

-- =====================================================
-- 7. VIEW: Linked notes with details
-- =====================================================
CREATE OR REPLACE VIEW public.note_links_with_details AS
SELECT 
  nl.id,
  nl.source_note_id,
  nl.target_note_id,
  nl.user_id,
  nl.similarity_score,
  nl.link_type,
  nl.created_by,
  nl.created_at,
  sn.summary as source_summary,
  sn.created_at as source_created_at,
  tn.summary as target_summary,
  tn.created_at as target_created_at
FROM public.note_links nl
JOIN public.notes sn ON sn.id = nl.source_note_id
JOIN public.notes tn ON tn.id = nl.target_note_id;

-- =====================================================
-- 8. Default smart folders for new users
-- =====================================================
-- This can be triggered by app logic when a user first creates notes
-- Example default folders: "Work", "Personal", "Ideas", "To-Do"

COMMENT ON TABLE public.note_links IS 'Bidirectional semantic links between related notes';
COMMENT ON TABLE public.smart_folders IS 'AI-powered folders that auto-categorize notes based on rules';
COMMENT ON TABLE public.smart_folder_assignments IS 'Assignments of notes to smart folders with confidence scores';
COMMENT ON FUNCTION public.auto_link_related_notes IS 'Automatically discover and create links to semantically similar notes';
COMMENT ON FUNCTION public.auto_categorize_note IS 'Automatically assign a note to matching smart folders based on rules';

ALTER TABLE public.smart_folders
  ALTER COLUMN workspace_id TYPE UUID USING workspace_id::UUID;

-- Update foreign key constraint to match the UUID type
ALTER TABLE public.smart_folders
  DROP CONSTRAINT IF EXISTS smart_folders_workspace_id_fkey,
  ADD CONSTRAINT smart_folders_workspace_id_fkey FOREIGN KEY (workspace_id)
  REFERENCES public.workspaces(id) ON DELETE CASCADE;
