-- =====================================================
-- CANVAS TEMPLATES SUPPORT
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Canvas Templates table
CREATE TABLE IF NOT EXISTS canvas_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom' CHECK (category IN ('custom', 'brainstorming', 'planning', 'diagram', 'mind-map', 'workflow', 'other')),
  
  -- Template content (ReactFlow data structure)
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of ReactFlow nodes
  edges JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of ReactFlow edges
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb, -- Initial viewport
  
  -- Visual metadata
  thumbnail_url TEXT, -- Preview image URL
  color_scheme TEXT DEFAULT 'default', -- Color theme identifier
  
  -- Ownership and permissions
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for personal templates
  is_public BOOLEAN DEFAULT FALSE, -- Public templates visible to all
  is_featured BOOLEAN DEFAULT FALSE, -- Featured by admins
  is_system BOOLEAN DEFAULT FALSE, -- Built-in templates (cannot be deleted by users)
  
  -- Usage tracking
  use_count INT DEFAULT 0,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Search tags
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT template_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT template_name_max_length CHECK (LENGTH(name) <= 200)
);

-- Indexes for canvas templates
CREATE INDEX IF NOT EXISTS idx_canvas_templates_creator ON canvas_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_canvas_templates_workspace ON canvas_templates(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_canvas_templates_category ON canvas_templates(category);
CREATE INDEX IF NOT EXISTS idx_canvas_templates_public ON canvas_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_canvas_templates_featured ON canvas_templates(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_canvas_templates_created ON canvas_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvas_templates_use_count ON canvas_templates(use_count DESC);

-- Full-text search index on template name and description
CREATE INDEX IF NOT EXISTS idx_canvas_templates_search 
  ON canvas_templates USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_canvas_templates_tags ON canvas_templates USING gin(tags);

-- Template usage tracking (who used which template)
CREATE TABLE IF NOT EXISTS canvas_template_usage (
  id BIGSERIAL PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES canvas_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canvas_id BIGINT, -- Optional: link to the created canvas
  used_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Track customizations
  was_modified BOOLEAN DEFAULT FALSE,
  
  UNIQUE(template_id, user_id, canvas_id)
);

CREATE INDEX IF NOT EXISTS idx_template_usage_template ON canvas_template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_user ON canvas_template_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_date ON canvas_template_usage(used_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE canvas_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_template_usage ENABLE ROW LEVEL SECURITY;

-- Canvas Templates policies

-- View: Users can see their own templates, public templates, and templates in their workspaces
CREATE POLICY "Users can view accessible templates"
  ON canvas_templates FOR SELECT
  USING (
    creator_id = auth.uid() 
    OR is_public = TRUE 
    OR is_system = TRUE
    OR (
      workspace_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_members.workspace_id = canvas_templates.workspace_id 
        AND workspace_members.user_id = auth.uid()
      )
    )
  );

-- Create: Users can create templates
CREATE POLICY "Users can create templates"
  ON canvas_templates FOR INSERT
  WITH CHECK (
    creator_id = auth.uid()
    AND (
      workspace_id IS NULL 
      OR EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_members.workspace_id = canvas_templates.workspace_id 
        AND workspace_members.user_id = auth.uid()
      )
    )
  );

-- Update: Users can update their own templates
CREATE POLICY "Users can update their own templates"
  ON canvas_templates FOR UPDATE
  USING (creator_id = auth.uid() AND is_system = FALSE);

-- Delete: Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
  ON canvas_templates FOR DELETE
  USING (creator_id = auth.uid() AND is_system = FALSE);

-- Template usage policies

-- Users can view their own usage history
CREATE POLICY "Users can view their own usage"
  ON canvas_template_usage FOR SELECT
  USING (user_id = auth.uid());

-- Users can record their template usage
CREATE POLICY "Users can record usage"
  ON canvas_template_usage FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to increment template use count
CREATE OR REPLACE FUNCTION increment_template_use_count(p_template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE canvas_templates
  SET use_count = use_count + 1
  WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular templates
CREATE OR REPLACE FUNCTION get_popular_templates(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  thumbnail_url TEXT,
  use_count INT,
  creator_id UUID,
  is_public BOOLEAN,
  is_featured BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.description,
    ct.category,
    ct.thumbnail_url,
    ct.use_count,
    ct.creator_id,
    ct.is_public,
    ct.is_featured,
    ct.created_at
  FROM canvas_templates ct
  WHERE 
    (p_category IS NULL OR ct.category = p_category)
    AND (
      ct.creator_id = p_user_id 
      OR ct.is_public = TRUE 
      OR ct.is_system = TRUE
      OR (
        ct.workspace_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = ct.workspace_id 
          AND wm.user_id = p_user_id
        )
      )
    )
  ORDER BY ct.is_featured DESC, ct.use_count DESC, ct.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search templates
CREATE OR REPLACE FUNCTION search_canvas_templates(
  p_user_id UUID,
  p_query TEXT,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  thumbnail_url TEXT,
  use_count INT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.description,
    ct.category,
    ct.thumbnail_url,
    ct.use_count,
    ts_rank(
      to_tsvector('english', ct.name || ' ' || COALESCE(ct.description, '')),
      plainto_tsquery('english', p_query)
    ) as rank
  FROM canvas_templates ct
  WHERE 
    (p_category IS NULL OR ct.category = p_category)
    AND to_tsvector('english', ct.name || ' ' || COALESCE(ct.description, '')) @@ plainto_tsquery('english', p_query)
    AND (
      ct.creator_id = p_user_id 
      OR ct.is_public = TRUE 
      OR ct.is_system = TRUE
      OR (
        ct.workspace_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = ct.workspace_id 
          AND wm.user_id = p_user_id
        )
      )
    )
  ORDER BY rank DESC, ct.use_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_canvas_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_canvas_template_timestamp ON canvas_templates;
CREATE TRIGGER trigger_update_canvas_template_timestamp
  BEFORE UPDATE ON canvas_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_template_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE canvas_templates IS 'Reusable canvas layout templates for brainstorming, planning, and diagramming';
COMMENT ON TABLE canvas_template_usage IS 'Tracks which users have used which templates';

COMMENT ON COLUMN canvas_templates.nodes IS 'ReactFlow nodes array: [{id, type, position, data}]';
COMMENT ON COLUMN canvas_templates.edges IS 'ReactFlow edges array: [{id, source, target, type}]';
COMMENT ON COLUMN canvas_templates.viewport IS 'Initial viewport: {x, y, zoom}';
COMMENT ON COLUMN canvas_templates.is_system IS 'Built-in templates that cannot be deleted by users';
COMMENT ON COLUMN canvas_templates.is_featured IS 'Featured templates shown prominently in UI';
