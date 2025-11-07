-- =====================================================
-- COMMENTS & DISCUSSIONS SYSTEM
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comments table (enhanced from existing)
-- Add new columns to existing comments table
DO $$ 
BEGIN
  -- Add canvas_node_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comments' AND column_name='canvas_node_id') THEN
    ALTER TABLE comments ADD COLUMN canvas_node_id TEXT;
  END IF;
  
  -- Add mentions if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comments' AND column_name='mentions') THEN
    ALTER TABLE comments ADD COLUMN mentions TEXT[] DEFAULT '{}';
  END IF;
  
  -- Add resolved columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comments' AND column_name='resolved') THEN
    ALTER TABLE comments ADD COLUMN resolved BOOLEAN DEFAULT FALSE;
    ALTER TABLE comments ADD COLUMN resolved_by UUID;
    ALTER TABLE comments ADD COLUMN resolved_at TIMESTAMPTZ;
  END IF;
  
  -- Add edited columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comments' AND column_name='edited') THEN
    ALTER TABLE comments ADD COLUMN edited BOOLEAN DEFAULT FALSE;
    ALTER TABLE comments ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;
END $$;

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_note_id ON comments(note_id);
CREATE INDEX IF NOT EXISTS idx_comments_canvas_node_id ON comments(canvas_node_id) WHERE canvas_node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON comments(resolved);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Mentions table for tracking @mentions
CREATE TABLE IF NOT EXISTS mentions (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  mentioned_by_user_id UUID NOT NULL,
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON mentions(mentioned_user_id, read);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id);

-- Comment reactions (like, heart, etc.)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'heart', 'thumbsup', 'celebrate', 'insightful')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions(user_id);

-- =====================================================
-- VERSION HISTORY & TIME TRAVEL
-- =====================================================

-- Enhanced note_versions table - add new columns to existing table
DO $$ 
BEGIN
  -- Add changed_fields if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='note_versions' AND column_name='changed_fields') THEN
    ALTER TABLE note_versions ADD COLUMN changed_fields TEXT[];
  END IF;
  
  -- Add diff_summary if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='note_versions' AND column_name='diff_summary') THEN
    ALTER TABLE note_versions ADD COLUMN diff_summary JSONB;
  END IF;
  
  -- Add snapshot_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='note_versions' AND column_name='snapshot_type') THEN
    ALTER TABLE note_versions ADD COLUMN snapshot_type TEXT DEFAULT 'manual' CHECK (snapshot_type IN ('auto', 'manual', 'restore'));
  END IF;
  
  -- Add parent_version_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='note_versions' AND column_name='parent_version_id') THEN
    ALTER TABLE note_versions ADD COLUMN parent_version_id BIGINT REFERENCES note_versions(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_note_versions_user ON note_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_created ON note_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_versions_type ON note_versions(snapshot_type);

-- Version diffs table for detailed change tracking
CREATE TABLE IF NOT EXISTS version_diffs (
  id BIGSERIAL PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES note_versions(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  diff_type TEXT CHECK (diff_type IN ('added', 'removed', 'modified')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_diffs_version ON version_diffs(version_id);

-- Canvas versions for canvas-specific snapshots
CREATE TABLE IF NOT EXISTS canvas_versions (
  id BIGSERIAL PRIMARY KEY,
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INT NOT NULL,
  
  -- Canvas snapshot
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL,
  title TEXT,
  description TEXT,
  
  -- Change tracking
  change_description TEXT,
  nodes_added INT DEFAULT 0,
  nodes_removed INT DEFAULT 0,
  nodes_modified INT DEFAULT 0,
  edges_added INT DEFAULT 0,
  edges_removed INT DEFAULT 0,
  
  snapshot_type TEXT DEFAULT 'manual' CHECK (snapshot_type IN ('auto', 'manual', 'restore')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canvas_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_canvas_versions_canvas ON canvas_versions(canvas_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_canvas_versions_user ON canvas_versions(user_id);

-- =====================================================
-- NOTIFICATIONS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mention', 'comment_reply', 'note_shared', 'workspace_invite', 'version_restored')),
  
  -- Related entities
  note_id BIGINT REFERENCES notes(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  canvas_id UUID REFERENCES canvases(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT,
  action_url TEXT,
  
  -- Actor (who triggered the notification)
  actor_user_id UUID,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  sent_email BOOLEAN DEFAULT FALSE,
  sent_push BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_note ON notifications(note_id) WHERE note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_comment ON notifications(comment_id) WHERE comment_id IS NOT NULL;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to create automatic version snapshot
CREATE OR REPLACE FUNCTION create_auto_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_version_number INT;
  v_changed_fields TEXT[];
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number
  FROM note_versions
  WHERE note_id = NEW.id;
  
  -- Determine which fields changed
  v_changed_fields := ARRAY[]::TEXT[];
  IF OLD.original_notes IS DISTINCT FROM NEW.original_notes THEN
    v_changed_fields := array_append(v_changed_fields, 'original_notes');
  END IF;
  IF OLD.summary IS DISTINCT FROM NEW.summary THEN
    v_changed_fields := array_append(v_changed_fields, 'summary');
  END IF;
  IF OLD.takeaways IS DISTINCT FROM NEW.takeaways THEN
    v_changed_fields := array_append(v_changed_fields, 'takeaways');
  END IF;
  IF OLD.actions IS DISTINCT FROM NEW.actions THEN
    v_changed_fields := array_append(v_changed_fields, 'actions');
  END IF;
  IF OLD.tags IS DISTINCT FROM NEW.tags THEN
    v_changed_fields := array_append(v_changed_fields, 'tags');
  END IF;
  
  -- Only create snapshot if something actually changed
  IF array_length(v_changed_fields, 1) > 0 THEN
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
      changed_fields,
      snapshot_type
    ) VALUES (
      NEW.id,
      NEW.user_id,
      v_version_number,
      NEW.original_notes,
      NEW.summary,
      NEW.takeaways,
      NEW.actions,
      NEW.tags,
      NEW.sentiment,
      v_changed_fields,
      'auto'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic version snapshots
DROP TRIGGER IF EXISTS trigger_auto_version_snapshot ON notes;
CREATE TRIGGER trigger_auto_version_snapshot
  AFTER UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION create_auto_version_snapshot();

-- Function to create mention notifications
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user_id UUID;
  v_note_id BIGINT;
  v_actor_name TEXT;
BEGIN
  -- Get note_id and actor name
  v_note_id := NEW.note_id;
  SELECT user_name FROM (SELECT id, user_name FROM auth.users) users WHERE id = NEW.user_id INTO v_actor_name;
  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;
  
  -- Create notifications for each mentioned user
  FOREACH mentioned_user_id IN ARRAY NEW.mentions
  LOOP
    -- Don't notify the commenter themselves
    IF mentioned_user_id != NEW.user_id THEN
      -- Create mention record
      INSERT INTO mentions (
        comment_id,
        mentioned_user_id,
        mentioned_by_user_id,
        note_id
      ) VALUES (
        NEW.id,
        mentioned_user_id,
        NEW.user_id,
        v_note_id
      );
      
      -- Create notification
      INSERT INTO notifications (
        user_id,
        type,
        note_id,
        comment_id,
        title,
        message,
        action_url,
        actor_user_id
      ) VALUES (
        mentioned_user_id,
        'mention',
        v_note_id,
        NEW.id,
        'You were mentioned in a comment',
        v_actor_name || ' mentioned you in a comment',
        '/notes/' || v_note_id::TEXT,
        NEW.user_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mention notifications
DROP TRIGGER IF EXISTS trigger_mention_notifications ON comments;
CREATE TRIGGER trigger_mention_notifications
  AFTER INSERT ON comments
  FOR EACH ROW
  WHEN (array_length(NEW.mentions, 1) > 0)
  EXECUTE FUNCTION create_mention_notifications();

-- Function to create comment reply notifications
CREATE OR REPLACE FUNCTION create_reply_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_user_id UUID;
  v_actor_name TEXT;
BEGIN
  -- Only for replies (not top-level comments)
  IF NEW.parent_id IS NOT NULL THEN
    -- Get the user who wrote the parent comment
    SELECT user_id INTO v_parent_user_id
    FROM comments
    WHERE id = NEW.parent_id;
    
    -- Don't notify if replying to yourself
    IF v_parent_user_id IS NOT NULL AND v_parent_user_id != NEW.user_id THEN
      -- Get actor name
      SELECT user_name FROM (SELECT id, user_name FROM auth.users) users WHERE id = NEW.user_id INTO v_actor_name;
      IF v_actor_name IS NULL THEN
        v_actor_name := 'Someone';
      END IF;
      
      -- Create notification
      INSERT INTO notifications (
        user_id,
        type,
        note_id,
        comment_id,
        title,
        message,
        action_url,
        actor_user_id
      ) VALUES (
        v_parent_user_id,
        'comment_reply',
        NEW.note_id,
        NEW.id,
        'New reply to your comment',
        v_actor_name || ' replied to your comment',
        '/notes/' || NEW.note_id::TEXT,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reply notifications
DROP TRIGGER IF EXISTS trigger_reply_notifications ON comments;
CREATE TRIGGER trigger_reply_notifications
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_reply_notifications();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Users can view comments on notes they can access"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = comments.note_id
      AND (notes.user_id = auth.uid() OR notes.is_public = true)
    )
  );

CREATE POLICY "Users can create comments on notes they can access"
  ON comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = comments.note_id
      AND (notes.user_id = auth.uid() OR notes.is_public = true)
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (user_id = auth.uid());

-- Mentions policies
CREATE POLICY "Users can view their own mentions"
  ON mentions FOR SELECT
  USING (mentioned_user_id = auth.uid());

-- Reactions policies
CREATE POLICY "Users can view reactions"
  ON comment_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can add reactions"
  ON comment_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions"
  ON comment_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Version history policies
CREATE POLICY "Users can view versions of their notes"
  ON note_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_versions.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view version diffs of their notes"
  ON version_diffs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM note_versions
      JOIN notes ON notes.id = note_versions.note_id
      WHERE note_versions.id = version_diffs.version_id
      AND notes.user_id = auth.uid()
    )
  );

-- Canvas versions policies
CREATE POLICY "Users can view versions of their canvases"
  ON canvas_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_versions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS FOR DIFFS
-- =====================================================

-- Function to calculate text diff statistics
CREATE OR REPLACE FUNCTION calculate_text_diff(old_text TEXT, new_text TEXT)
RETURNS JSONB AS $$
DECLARE
  old_lines TEXT[];
  new_lines TEXT[];
  lines_added INT := 0;
  lines_removed INT := 0;
  lines_modified INT := 0;
BEGIN
  -- Split into lines
  old_lines := string_to_array(old_text, E'\n');
  new_lines := string_to_array(new_text, E'\n');
  
  -- Simple diff calculation (can be enhanced with actual diff algorithm)
  lines_added := GREATEST(0, array_length(new_lines, 1) - array_length(old_lines, 1));
  lines_removed := GREATEST(0, array_length(old_lines, 1) - array_length(new_lines, 1));
  
  RETURN jsonb_build_object(
    'lines_added', lines_added,
    'lines_removed', lines_removed,
    'old_length', length(old_text),
    'new_length', length(new_text),
    'char_diff', length(new_text) - length(old_text)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE comments IS 'Threaded comments on notes and canvas nodes with mention support';
COMMENT ON TABLE mentions IS 'Tracks @mentions in comments for notification purposes';
COMMENT ON TABLE comment_reactions IS 'User reactions (likes, hearts, etc.) on comments';
COMMENT ON TABLE note_versions IS 'Automatic and manual snapshots of note versions';
COMMENT ON TABLE version_diffs IS 'Detailed field-level diffs between versions';
COMMENT ON TABLE canvas_versions IS 'Version history for canvas snapshots';
COMMENT ON TABLE notifications IS 'User notifications for mentions, replies, and other events';
