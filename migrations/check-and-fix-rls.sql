-- ============================================================================
-- RLS Policy Diagnostic and Fix Script
-- Run this in Supabase SQL Editor to diagnose and fix RLS issues
-- ============================================================================

-- STEP 1: Check which tables have RLS enabled
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- STEP 2: Check existing policies
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- STEP 3: Test table access (should work for authenticated users)
-- ============================================================================
-- This will show if the anon role can access tables
-- Run each SELECT to see which ones fail

-- Test notes table
SELECT COUNT(*) as note_count FROM public.notes;

-- Test folders table  
SELECT COUNT(*) as folder_count FROM public.folders;

-- Test workspaces table
SELECT COUNT(*) as workspace_count FROM public.workspaces;

-- Test personas table
SELECT COUNT(*) as persona_count FROM public.personas;

-- ============================================================================
-- CREATE MISSING TABLES
-- ============================================================================

-- Create saved_searches table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIXES: Add/Update RLS policies for authenticated users
-- ============================================================================

-- Fix 1: Notes table - Allow authenticated users to access their own notes
-- ============================================================================
DROP POLICY IF EXISTS "Users can access own notes" ON public.notes;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.notes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notes;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.notes;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.notes;

-- Ensure RLS is enabled
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies
CREATE POLICY "Users can select own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- Fix 2: Folders table
-- ============================================================================
DROP POLICY IF EXISTS "Users can access own folders" ON public.folders;
DROP POLICY IF EXISTS "Enable read access for own folders" ON public.folders;

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- Fix 3: Workspaces table
-- ============================================================================
DROP POLICY IF EXISTS "Users can access own workspaces" ON public.workspaces;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Users can see workspaces they own
CREATE POLICY "Users can select own workspaces"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can see workspaces they're members of (via workspace_members table)
CREATE POLICY "Users can select member workspaces"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own workspaces"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- Fix 4: Personas table
-- ============================================================================
DROP POLICY IF EXISTS "Users can access own personas" ON public.personas;

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own personas"
  ON public.personas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personas"
  ON public.personas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personas"
  ON public.personas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personas"
  ON public.personas FOR DELETE
  USING (auth.uid() = user_id);

-- Fix 5: Tags table (typically needs to be readable by all users)
-- ============================================================================
DROP POLICY IF EXISTS "Tags are viewable by authenticated users" ON public.tags;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see all tags (for autocomplete/search)
CREATE POLICY "Users can select all tags"
  ON public.tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tags"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix 6: Templates table (system templates + user templates)
-- ============================================================================
DROP POLICY IF EXISTS "Templates viewable by users" ON public.templates;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Users can see system templates (user_id is null) and their own templates
CREATE POLICY "Users can select accessible templates"
  ON public.templates FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON public.templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON public.templates FOR DELETE
  USING (auth.uid() = user_id);

-- Fix 7: Saved searches
-- ============================================================================
DROP POLICY IF EXISTS "Users can access own saved searches" ON public.saved_searches;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Fix 8: Create or replace folder_stats view with SECURITY DEFINER
-- ============================================================================
-- Views don't inherit RLS policies by default, so we need SECURITY DEFINER
-- This allows authenticated users to see their own folder stats

DROP VIEW IF EXISTS public.folder_stats;

CREATE OR REPLACE VIEW public.folder_stats
WITH (security_invoker = false)  -- Use security definer
AS
SELECT 
    f.id,
    f.user_id,
    f.name,
    f.description,
    f.color,
    f.created_at,
    f.updated_at,
    COALESCE(COUNT(n.id), 0) as note_count
FROM public.folders f
LEFT JOIN public.notes n ON n.folder_id = f.id
GROUP BY f.id, f.user_id, f.name, f.description, f.color, f.created_at, f.updated_at;

-- Grant access to authenticated users
GRANT SELECT ON public.folder_stats TO authenticated;

-- Alternative: Create workspace_stats view if needed
DROP VIEW IF EXISTS public.workspace_stats;

CREATE OR REPLACE VIEW public.workspace_stats
WITH (security_invoker = false)
AS
SELECT 
    w.id,
    w.owner_id,
    w.name,
    w.description,
    w.created_at,
    w.updated_at,
    COUNT(DISTINCT wm.user_id) as member_count,
    COUNT(DISTINCT n.id) as note_count
FROM public.workspaces w
LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN public.notes n ON n.workspace_id = w.id
GROUP BY w.id, w.owner_id, w.name, w.description, w.created_at, w.updated_at;

GRANT SELECT ON public.workspace_stats TO authenticated;

-- ============================================================================
-- VERIFICATION: Check policies were created
-- ============================================================================
SELECT 
    tablename,
    policyname,
    cmd AS operation,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- TEST: Try accessing tables again (should work now for authenticated users)
-- ============================================================================
-- These should return counts without errors
SELECT 'notes' as table_name, COUNT(*) as count FROM public.notes
UNION ALL
SELECT 'folders', COUNT(*) FROM public.folders
UNION ALL
SELECT 'workspaces', COUNT(*) FROM public.workspaces
UNION ALL
SELECT 'personas', COUNT(*) FROM public.personas
UNION ALL
SELECT 'tags', COUNT(*) FROM public.tags
UNION ALL
SELECT 'templates', COUNT(*) FROM public.templates
UNION ALL
SELECT 'saved_searches', COUNT(*) FROM public.saved_searches;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. These policies assume you're using Supabase Auth with auth.uid()
-- 2. The "authenticated" role is a built-in Supabase role for logged-in users
-- 3. Views like folder_stats may need separate policies or function SECURITY DEFINER
-- 4. Adjust policies based on your specific sharing/collaboration requirements
-- 5. For public sharing features, add separate policies for anonymous access
