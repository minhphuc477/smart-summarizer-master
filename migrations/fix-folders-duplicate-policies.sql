-- Clean up duplicate RLS policies on folders table
-- Keep only the simple, non-recursive policies

-- Drop ALL existing policies on folders
DROP POLICY IF EXISTS "Users can select own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view their folders or workspace folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create folders in their workspaces" ON public.folders;

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Create simple, clean policies (no workspace_members references to avoid recursion)

-- SELECT: Users can view their own folders
CREATE POLICY "Users can view own folders"
  ON public.folders FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can create their own folders
CREATE POLICY "Users can create own folders"
  ON public.folders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own folders
CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own folders
CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (user_id = auth.uid());

-- Verify policies
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'folders'
ORDER BY cmd, policyname;
