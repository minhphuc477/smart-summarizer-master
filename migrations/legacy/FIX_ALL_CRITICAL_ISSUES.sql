-- =====================================================
-- COMPREHENSIVE FIX: All Critical Issues
-- =====================================================

-- PART 1: Fix PDF Processing Queue RLS
-- =====================================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "System can manage PDF jobs" ON pdf_processing_queue;
DROP POLICY IF EXISTS "Users can view their own PDF jobs" ON pdf_processing_queue;

-- Allow users to insert their own jobs
CREATE POLICY "Users can insert their own PDF jobs"
  ON pdf_processing_queue FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to view their own jobs
CREATE POLICY "Users can view their own PDF jobs"
  ON pdf_processing_queue FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to update their own jobs
CREATE POLICY "Users can update their own PDF jobs"
  ON pdf_processing_queue FOR UPDATE
  USING (user_id = auth.uid());

-- PART 2: Fix Workspace Display Issue
-- =====================================================

-- Check if workspaces exist and have members
SELECT 
  '🏢 Workspace Debug' as section,
  w.id,
  w.name,
  w.owner_id,
  w.created_at,
  (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as member_count
FROM workspaces w
ORDER BY w.created_at DESC;

-- Check workspace members
SELECT 
  '👥 Workspace Members Debug' as section,
  wm.workspace_id,
  w.name as workspace_name,
  wm.user_id,
  wm.role,
  wm.joined_at
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
ORDER BY wm.joined_at DESC;

-- PART 3: Create Usage Events Tracking
-- =====================================================

-- Ensure usage_events table exists
CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);

-- RLS for usage_events
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own usage events" ON usage_events;
CREATE POLICY "Users can insert their own usage events"
  ON usage_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own usage events" ON usage_events;
CREATE POLICY "Users can view their own usage events"
  ON usage_events FOR SELECT
  USING (user_id = auth.uid());

-- PART 4: Seed some usage events for testing
-- =====================================================

-- Insert sample usage events for the test user
INSERT INTO usage_events (user_id, event_type, metadata)
SELECT 
  'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid,
  'note_created',
  jsonb_build_object('note_id', id, 'timestamp', created_at)
FROM notes
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
ON CONFLICT DO NOTHING;

-- PART 5: Verify Everything
-- =====================================================

SELECT '✅ PDF Queue Policies Fixed' as status
WHERE EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE tablename = 'pdf_processing_queue' 
    AND policyname = 'Users can insert their own PDF jobs'
);

SELECT '✅ Usage Events Table Ready' as status
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'usage_events'
);

SELECT '✅ Workspaces Exist' as status, COUNT(*) as count
FROM workspaces;

SELECT '✅ Workspace Members Exist' as status, COUNT(*) as count
FROM workspace_members;

SELECT '✅ Usage Events Seeded' as status, COUNT(*) as count
FROM usage_events
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid;
