-- =====================================================
-- Phase 5: Real-Time Collaboration Schema
-- =====================================================
-- Features: Comments, Presence, Version History
-- Date: November 1, 2025
-- =====================================================

-- Enable Realtime for existing tables
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE folders;
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;

-- =====================================================
-- 1. COMMENTS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE, -- for threaded replies
  content TEXT NOT NULL,
  mentions UUID[], -- array of user_ids mentioned with @
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT comments_content_not_empty CHECK (length(trim(content)) > 0)
);

CREATE INDEX idx_comments_note_id ON comments(note_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- RLS Policies for comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Users can read comments on notes they have access to
CREATE POLICY "Users can read comments on accessible notes"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = comments.note_id
      AND (
        notes.user_id = auth.uid()
        OR notes.is_public = TRUE
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          JOIN notes n ON n.workspace_id = wm.workspace_id
          WHERE n.id = comments.note_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

-- Users can create comments on notes they have access to
CREATE POLICY "Users can create comments on accessible notes"
  ON comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = comments.note_id
      AND (
        notes.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          JOIN notes n ON n.workspace_id = wm.workspace_id
          WHERE n.id = comments.note_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments OR note owners can delete comments on their notes
CREATE POLICY "Users can delete own comments or comments on their notes"
  ON comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = comments.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. PRESENCE SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS presence (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id BIGINT REFERENCES notes(id) ON DELETE CASCADE,
  canvas_id TEXT, -- future canvas support
  status TEXT NOT NULL DEFAULT 'viewing', -- viewing, editing, idle
  cursor_position JSONB, -- { x: number, y: number, selection: {...} }
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One presence record per user per resource
  UNIQUE(user_id, note_id)
);

CREATE INDEX idx_presence_note_id ON presence(note_id);
CREATE INDEX idx_presence_user_id ON presence(user_id);
CREATE INDEX idx_presence_last_seen ON presence(last_seen DESC);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE presence;

-- RLS Policies for presence
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Users can see presence on notes they have access to
CREATE POLICY "Users can read presence on accessible notes"
  ON presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = presence.note_id
      AND (
        notes.user_id = auth.uid()
        OR notes.is_public = TRUE
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          JOIN notes n ON n.workspace_id = wm.workspace_id
          WHERE n.id = presence.note_id
          AND wm.user_id = auth.uid()
        )
      )
    )
  );

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence"
  ON presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own presence
CREATE POLICY "Users can update own presence"
  ON presence FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own presence
CREATE POLICY "Users can delete own presence"
  ON presence FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 3. VERSION HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS note_versions (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  
  -- Snapshot of note content
  original_notes TEXT,
  summary TEXT,
  takeaways JSONB,
  actions JSONB,
  tags TEXT[],
  sentiment TEXT,
  
  -- Metadata
  change_description TEXT, -- optional: what changed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One version number per note
  UNIQUE(note_id, version_number)
);

CREATE INDEX idx_note_versions_note_id ON note_versions(note_id);
CREATE INDEX idx_note_versions_created_at ON note_versions(created_at DESC);

-- RLS Policies for note_versions
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- Users can read versions of their own notes
CREATE POLICY "Users can read versions of own notes"
  ON note_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_versions.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- System can insert versions (handled by trigger)
CREATE POLICY "System can insert versions"
  ON note_versions FOR INSERT
  WITH CHECK (TRUE);

-- Users can delete versions of their own notes
CREATE POLICY "Users can delete versions of own notes"
  ON note_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_versions.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. TRIGGERS FOR AUTOMATIC VERSION HISTORY
-- =====================================================

-- Function to create a version snapshot
CREATE OR REPLACE FUNCTION create_note_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM note_versions
  WHERE note_id = OLD.id;
  
  -- Create version snapshot
  INSERT INTO note_versions (
    note_id,
    user_id,
    version_number,
    original_notes,
    summary,
    takeaways,
    actions,
    tags,
    sentiment,
    change_description
  ) VALUES (
    OLD.id,
    OLD.user_id,
    next_version,
    OLD.original_notes,
    OLD.summary,
    OLD.takeaways,
    OLD.actions,
    OLD.tags,
    OLD.sentiment,
    'Auto-saved version'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on note updates (create version before update)
DROP TRIGGER IF EXISTS create_note_version_on_update ON notes;
CREATE TRIGGER create_note_version_on_update
  BEFORE UPDATE ON notes
  FOR EACH ROW
  WHEN (
    OLD.original_notes IS DISTINCT FROM NEW.original_notes
    OR OLD.summary IS DISTINCT FROM NEW.summary
    OR OLD.takeaways IS DISTINCT FROM NEW.takeaways
    OR OLD.actions IS DISTINCT FROM NEW.actions
  )
  EXECUTE FUNCTION create_note_version();

-- =====================================================
-- 5. CLEANUP FUNCTION FOR STALE PRESENCE
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM presence
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. HELPER VIEWS
-- =====================================================

-- View: Recent comments with user info
CREATE OR REPLACE VIEW comment_details AS
SELECT 
  c.id,
  c.note_id,
  c.user_id,
  c.parent_id,
  c.content,
  c.mentions,
  c.resolved,
  c.created_at,
  c.updated_at,
  u.email as user_email,
  u.raw_user_meta_data->>'full_name' as user_name,
  u.raw_user_meta_data->>'avatar_url' as user_avatar
FROM comments c
LEFT JOIN auth.users u ON c.user_id = u.id;

-- View: Active presence with user info
CREATE OR REPLACE VIEW active_presence AS
SELECT 
  p.id,
  p.user_id,
  p.note_id,
  p.status,
  p.cursor_position,
  p.last_seen,
  u.email as user_email,
  u.raw_user_meta_data->>'full_name' as user_name,
  u.raw_user_meta_data->>'avatar_url' as user_avatar
FROM presence p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.last_seen > NOW() - INTERVAL '2 minutes';

-- =====================================================
-- 7. COMMENT NOTIFICATIONS (optional table)
-- =====================================================

CREATE TABLE IF NOT EXISTS comment_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, comment_id)
);

CREATE INDEX idx_comment_notifications_user_id ON comment_notifications(user_id);
CREATE INDEX idx_comment_notifications_read ON comment_notifications(read);

ALTER TABLE comment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON comment_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON comment_notifications FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can update own notifications"
  ON comment_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- =====================================================
-- DONE! 🎉
-- =====================================================
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Enable Realtime in Supabase Dashboard for new tables
-- 3. Implement client-side presence tracking
-- 4. Build comment UI components
-- 5. Add version history viewer
-- =====================================================
