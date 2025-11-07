-- Comprehensive fix for ALL table policies to eliminate recursion
-- This will clean up tags, note_tags, and any other tables causing issues

-- ===== TAGS TABLE =====
DROP POLICY IF EXISTS "Users can select own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can create their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can create own tags" ON public.tags;
DROP POLICY IF EXISTS "Public tags are viewable by everyone" ON public.tags;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags"
  ON public.tags FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tags"
  ON public.tags FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tags"
  ON public.tags FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tags"
  ON public.tags FOR DELETE
  USING (user_id = auth.uid());

-- ===== NOTE_TAGS TABLE =====
DROP POLICY IF EXISTS "Users can select own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can insert own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can delete own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can view their note tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can add tags to their notes" ON public.note_tags;
DROP POLICY IF EXISTS "Users can remove tags from their notes" ON public.note_tags;
DROP POLICY IF EXISTS "Users can view note tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can create note tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can delete note tags" ON public.note_tags;

ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

-- Simple policy: Check ownership via notes.user_id
CREATE POLICY "Users can view own note tags"
  ON public.note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own note tags"
  ON public.note_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own note tags"
  ON public.note_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- ===== SAVED_SEARCHES TABLE =====
DROP POLICY IF EXISTS "Users can select own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can insert own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can update own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can delete own searches" ON public.saved_searches;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own searches"
  ON public.saved_searches FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own searches"
  ON public.saved_searches FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own searches"
  ON public.saved_searches FOR DELETE
  USING (user_id = auth.uid());

-- Verify all policies
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN qual LIKE '%workspace_members%' THEN '⚠️ RECURSIVE'
    WHEN qual LIKE '%workspaces%' THEN '⚠️ MAY RECURSE'
    ELSE '✅ OK'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('notes', 'tags', 'note_tags', 'folders', 'personas', 'workspaces', 'workspace_members', 'saved_searches')
ORDER BY tablename, cmd, policyname;
