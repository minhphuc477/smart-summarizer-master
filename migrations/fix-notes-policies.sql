-- Fix notes table RLS policies to avoid recursion
-- The issue is notes joining folders which references workspace_members

-- Drop ALL existing policies on notes
DROP POLICY IF EXISTS "Users can select own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Public notes are viewable by everyone" ON public.notes;
DROP POLICY IF EXISTS "Users can view notes shared with them" ON public.notes;
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create simple, clean policies (no cross-table joins)

-- SELECT: Users can view their own notes OR public notes
CREATE POLICY "Users can view own or public notes"
  ON public.notes FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

-- INSERT: Users can create their own notes
CREATE POLICY "Users can create own notes"
  ON public.notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own notes
CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (user_id = auth.uid());

-- Verify policies
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'notes'
ORDER BY cmd, policyname;
