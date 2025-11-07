-- =====================================================
-- MIGRATION: Advanced Features
-- =====================================================
-- 1. Infinite Canvas / Whiteboard
-- 2. Templates Library
-- 3. Analytics & Usage Tracking
-- 4. Multi-language Support
-- 5. Encryption Keys
-- =====================================================

-- =====================================================
-- 1. INFINITE CANVAS / WHITEBOARD
-- =====================================================

-- Bảng canvases: Lưu thông tin canvas
CREATE TABLE IF NOT EXISTS public.canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Canvas',
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_public BOOLEAN DEFAULT FALSE,
  share_id UUID UNIQUE DEFAULT gen_random_uuid()
);

-- Bảng canvas_nodes: Lưu các node trên canvas
CREATE TABLE IF NOT EXISTS public.canvas_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, -- Client-generated ID for React Flow
  type TEXT NOT NULL DEFAULT 'note', -- 'note', 'sticky', 'shape', 'image', 'text'
  content TEXT,
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT DEFAULT 200,
  height FLOAT DEFAULT 150,
  color TEXT DEFAULT '#fef3c7',
  background_color TEXT DEFAULT '#fef3c7',
  border_color TEXT DEFAULT '#fbbf24',
  font_size INTEGER DEFAULT 14,
  font_family TEXT DEFAULT 'Inter',
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional props
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canvas_id, node_id)
);

-- Bảng canvas_edges: Lưu các đường nối
CREATE TABLE IF NOT EXISTS public.canvas_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  edge_id TEXT NOT NULL, -- Client-generated ID
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  type TEXT DEFAULT 'default', -- 'default', 'straight', 'step', 'smoothstep', 'bezier'
  label TEXT,
  color TEXT DEFAULT '#94a3b8',
  animated BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canvas_id, edge_id)
);

-- Indexes cho canvas
CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON public.canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_canvases_workspace_id ON public.canvases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_canvases_share_id ON public.canvases(share_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_canvas_id ON public.canvas_nodes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_canvas_id ON public.canvas_edges(canvas_id);

-- RLS for canvases
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_edges ENABLE ROW LEVEL SECURITY;

-- Policies for canvases
CREATE POLICY "Users can view their own canvases or workspace canvases or public canvases"
  ON public.canvases FOR SELECT
  USING (
    user_id = auth.uid() 
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
    OR is_public = TRUE
  );

CREATE POLICY "Users can create canvases"
  ON public.canvases FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own canvases"
  ON public.canvases FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own canvases"
  ON public.canvases FOR DELETE
  USING (user_id = auth.uid());

-- Policies for canvas_nodes
CREATE POLICY "Users can view nodes of accessible canvases"
  ON public.canvas_nodes FOR SELECT
  USING (
    canvas_id IN (
      SELECT id FROM public.canvases 
      WHERE user_id = auth.uid() 
        OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
        OR is_public = TRUE
    )
  );

CREATE POLICY "Users can manage nodes of their canvases"
  ON public.canvas_nodes FOR ALL
  USING (
    canvas_id IN (SELECT id FROM public.canvases WHERE user_id = auth.uid())
  );

-- Policies for canvas_edges
CREATE POLICY "Users can view edges of accessible canvases"
  ON public.canvas_edges FOR SELECT
  USING (
    canvas_id IN (
      SELECT id FROM public.canvases 
      WHERE user_id = auth.uid() 
        OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
        OR is_public = TRUE
    )
  );

CREATE POLICY "Users can manage edges of their canvases"
  ON public.canvas_edges FOR ALL
  USING (
    canvas_id IN (SELECT id FROM public.canvases WHERE user_id = auth.uid())
  );

-- =====================================================
-- 2. TEMPLATES LIBRARY
-- =====================================================

-- Bảng templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'meeting', 'project', 'standup', 'review', 'brainstorm', 'custom'
  icon TEXT DEFAULT '📝',
  persona_prompt TEXT, -- Default persona for this template
  structure JSONB NOT NULL, -- Template structure with placeholders
  is_system BOOLEAN DEFAULT FALSE, -- System templates vs user templates
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for templates
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON public.templates(is_system);

-- RLS for templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view system templates"
  ON public.templates FOR SELECT
  USING (is_system = TRUE OR user_id = auth.uid());

CREATE POLICY "Users can create their own templates"
  ON public.templates FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_system = FALSE);

CREATE POLICY "Users can update their own templates"
  ON public.templates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
  ON public.templates FOR DELETE
  USING (user_id = auth.uid());

-- Insert system templates
INSERT INTO public.templates (name, description, category, icon, persona_prompt, structure, is_system) VALUES
(
  'Meeting Notes',
  'Structure for recording meeting discussions and action items',
  'meeting',
  '🤝',
  'You are a professional meeting note-taker. Focus on key decisions, action items, and next steps.',
  '{
    "sections": [
      {"title": "Meeting Details", "fields": ["Date", "Attendees", "Duration"]},
      {"title": "Agenda", "fields": ["Topics to discuss"]},
      {"title": "Discussion Points", "fields": ["Key discussions"]},
      {"title": "Decisions Made", "fields": ["Important decisions"]},
      {"title": "Action Items", "fields": ["Who", "What", "When"]},
      {"title": "Next Steps", "fields": ["Follow-up items"]}
    ]
  }'::jsonb,
  TRUE
),
(
  'Daily Standup',
  'Quick daily team sync template',
  'standup',
  '🏃',
  'You are a scrum master. Extract what was done, what will be done, and blockers.',
  '{
    "sections": [
      {"title": "Yesterday", "fields": ["What I accomplished"]},
      {"title": "Today", "fields": ["What I will work on"]},
      {"title": "Blockers", "fields": ["Issues or obstacles"]}
    ]
  }'::jsonb,
  TRUE
),
(
  'Project Update',
  'Weekly or monthly project status update',
  'project',
  '📊',
  'You are a project manager. Summarize progress, risks, and upcoming milestones.',
  '{
    "sections": [
      {"title": "Progress Summary", "fields": ["Completed items", "Percentage complete"]},
      {"title": "Key Achievements", "fields": ["Major wins"]},
      {"title": "Challenges", "fields": ["Issues encountered"]},
      {"title": "Risks", "fields": ["Potential problems"]},
      {"title": "Next Milestone", "fields": ["Upcoming goals", "Timeline"]}
    ]
  }'::jsonb,
  TRUE
),
(
  'Code Review',
  'Template for code review notes',
  'review',
  '💻',
  'You are a senior developer. Focus on code quality, bugs, and improvement suggestions.',
  '{
    "sections": [
      {"title": "PR Details", "fields": ["PR number", "Author", "Description"]},
      {"title": "Strengths", "fields": ["Good practices"]},
      {"title": "Issues Found", "fields": ["Bugs", "Security concerns"]},
      {"title": "Suggestions", "fields": ["Improvements", "Refactoring ideas"]},
      {"title": "Verdict", "fields": ["Approve/Request Changes"]}
    ]
  }'::jsonb,
  TRUE
),
(
  'Brainstorming Session',
  'Capture creative ideas and brainstorming',
  'brainstorm',
  '💡',
  'You are a creative facilitator. Organize ideas into themes and identify promising concepts.',
  '{
    "sections": [
      {"title": "Goal", "fields": ["What we are brainstorming about"]},
      {"title": "Ideas", "fields": ["All suggestions"]},
      {"title": "Top Ideas", "fields": ["Most promising"]},
      {"title": "Next Actions", "fields": ["How to move forward"]}
    ]
  }'::jsonb,
  TRUE
);

-- =====================================================
-- 3. ANALYTICS & USAGE TRACKING
-- =====================================================

-- Bảng user_analytics: Theo dõi hoạt động người dùng
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes_created INTEGER DEFAULT 0,
  summaries_generated INTEGER DEFAULT 0,
  canvases_created INTEGER DEFAULT 0,
  templates_used INTEGER DEFAULT 0,
  words_processed INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(user_id, date)
);

-- Bảng usage_events: Log các events
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'note_created', 'summary_generated', 'template_used', etc.
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_date ON public.user_analytics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON public.usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at DESC);

-- RLS
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
  ON public.user_analytics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own events"
  ON public.usage_events FOR SELECT
  USING (user_id = auth.uid());

-- Function to increment analytics
CREATE OR REPLACE FUNCTION increment_user_analytics(
  p_user_id UUID,
  p_event_type TEXT,
  p_increment_value INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_analytics (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;
  
  CASE p_event_type
    WHEN 'note_created' THEN
      UPDATE public.user_analytics 
      SET notes_created = notes_created + p_increment_value
      WHERE user_id = p_user_id AND date = CURRENT_DATE;
    WHEN 'summary_generated' THEN
      UPDATE public.user_analytics 
      SET summaries_generated = summaries_generated + p_increment_value
      WHERE user_id = p_user_id AND date = CURRENT_DATE;
    WHEN 'canvas_created' THEN
      UPDATE public.user_analytics 
      SET canvases_created = canvases_created + p_increment_value
      WHERE user_id = p_user_id AND date = CURRENT_DATE;
    WHEN 'template_used' THEN
      UPDATE public.user_analytics 
      SET templates_used = templates_used + p_increment_value
      WHERE user_id = p_user_id AND date = CURRENT_DATE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. MULTI-LANGUAGE SUPPORT
-- =====================================================

-- Bảng user_preferences: Lưu preferences của user
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'en', -- 'en', 'vi', 'zh', 'ja', 'ko'
  theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  notification_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- =====================================================
-- 5. ENCRYPTION KEYS (for E2E encryption)
-- =====================================================

-- Bảng encryption_keys: Lưu encrypted keys
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL, -- 'master', 'workspace', 'note'
  encrypted_key TEXT NOT NULL, -- Encrypted with user's password-derived key
  salt TEXT NOT NULL,
  iv TEXT NOT NULL, -- Initialization vector
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_encryption_keys_user_id ON public.encryption_keys(user_id);

-- RLS
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own encryption keys"
  ON public.encryption_keys FOR ALL
  USING (user_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_canvases_updated_at
  BEFORE UPDATE ON public.canvases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canvas_nodes_updated_at
  BEFORE UPDATE ON public.canvas_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS
-- =====================================================

-- View: User analytics summary
CREATE OR REPLACE VIEW user_analytics_summary AS
SELECT 
  user_id,
  SUM(notes_created) as total_notes,
  SUM(summaries_generated) as total_summaries,
  SUM(canvases_created) as total_canvases,
  SUM(templates_used) as total_templates_used,
  SUM(words_processed) as total_words,
  SUM(active_minutes) as total_active_minutes,
  COUNT(DISTINCT date) as active_days,
  MAX(date) as last_active_date
FROM public.user_analytics
GROUP BY user_id;

GRANT SELECT ON user_analytics_summary TO authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
