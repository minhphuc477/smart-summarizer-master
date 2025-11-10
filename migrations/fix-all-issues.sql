-- =====================================================
-- COMPLETE FIX FOR ALL REPORTED ISSUES
-- Run this in Supabase SQL Editor
-- =====================================================

-- ==================== ISSUE 1: WORKSPACE CREATION ====================
-- Fix RLS policy that prevents workspace owner from adding themselves

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.workspace_members;

-- Create new policy that allows workspace owner to add themselves
CREATE POLICY "Owners and admins can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    -- Allow adding yourself as owner of a workspace you own
    (
      user_id = auth.uid() 
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM public.workspaces w 
        WHERE w.id = workspace_id AND w.owner_id = auth.uid()
      )
    )
    OR
    -- Allow existing owners/admins to add other members  
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ==================== VERIFICATION QUERIES ====================

-- Check existing workspaces
SELECT 
  'Existing Workspaces' as info,
  COUNT(*) as total_workspaces 
FROM workspaces;

-- Show all workspaces with member counts
SELECT 
  w.id,
  w.name,
  w.description,
  w.owner_id,
  w.created_at,
  COUNT(wm.user_id) as member_count
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
GROUP BY w.id, w.name, w.description, w.owner_id, w.created_at
ORDER BY w.created_at DESC;

-- Check RLS policies
SELECT 
  'RLS Policies Check' as info,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('workspaces', 'workspace_members')
ORDER BY tablename, policyname;

-- ==================== PDF STATUS CHECK ====================

-- Show all PDFs and their statuses
SELECT 
  id,
  original_filename,
  file_size_bytes / 1024 as size_kb,
  status,
  created_at,
  updated_at
FROM pdf_documents
ORDER BY created_at DESC
LIMIT 20;

-- Count PDFs by status
SELECT 
  status,
  COUNT(*) as count
FROM pdf_documents
GROUP BY status;

-- ==================== USAGE EVENTS CHECK ====================

-- Check if usage_events table exists and has data
SELECT 
  'Usage Events' as info,
  COUNT(*) as total_events
FROM usage_events;

-- Show recent usage events
SELECT 
  event_type,
  created_at
FROM usage_events
ORDER BY created_at DESC
LIMIT 10;

-- ==================== NOTES & EMBEDDINGS CHECK ====================

-- Check notes with embeddings (for semantic search)
SELECT 
  'Notes with Embeddings' as info,
  COUNT(*) as total_notes,
  COUNT(embedding) as notes_with_embeddings,
  ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) as percentage_with_embeddings
FROM notes;

-- Show sample notes (for testing semantic search)
SELECT 
  id,
  LEFT(summary, 50) as summary_preview,
  CASE WHEN embedding IS NOT NULL THEN 'Yes' ELSE 'No' END as has_embedding,
  created_at
FROM notes
ORDER BY created_at DESC
LIMIT 5;
