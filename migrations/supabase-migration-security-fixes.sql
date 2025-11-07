-- =====================================================
-- SECURITY FIXES FOR DATABASE LINTER WARNINGS
-- =====================================================
-- This migration addresses security vulnerabilities identified by Supabase linter:
-- 1. auth_users_exposed: Views exposing auth.users to anon/authenticated roles
-- 2. security_definer_view: Views with SECURITY DEFINER property

-- =====================================================
-- 1. DROP INSECURE VIEWS
-- =====================================================

-- Drop views that expose auth.users data
DROP VIEW IF EXISTS comment_details CASCADE;
DROP VIEW IF EXISTS active_presence CASCADE;
DROP VIEW IF EXISTS user_workspaces CASCADE;
DROP VIEW IF EXISTS workspace_stats CASCADE;
DROP VIEW IF EXISTS note_links_with_details CASCADE;
DROP VIEW IF EXISTS user_analytics_summary CASCADE;

-- =====================================================
-- 2. CREATE SECURE FUNCTIONS INSTEAD OF VIEWS
-- =====================================================

-- Function: Get comment details (replaces comment_details view)
CREATE OR REPLACE FUNCTION get_comment_details(p_note_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  note_id UUID,
  user_id UUID,
  parent_id UUID,
  content TEXT,
  mentions JSONB,
  resolved BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_email TEXT,
  user_name TEXT,
  user_avatar TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only return comments for notes the user has access to
  RETURN QUERY
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
  LEFT JOIN auth.users u ON c.user_id = u.id
  INNER JOIN notes n ON c.note_id = n.id
  WHERE (p_note_id IS NULL OR c.note_id = p_note_id)
    AND (
      n.user_id = auth.uid() 
      OR n.is_public = true
      OR EXISTS (
        SELECT 1 FROM workspace_members wm 
        WHERE wm.workspace_id = n.workspace_id 
        AND wm.user_id = auth.uid()
      )
    );
END;
$$;

-- Function: Get active presence (replaces active_presence view)
CREATE OR REPLACE FUNCTION get_active_presence(p_note_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  note_id UUID,
  status TEXT,
  cursor_position JSONB,
  last_seen TIMESTAMPTZ,
  user_email TEXT,
  user_name TEXT,
  user_avatar TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
  INNER JOIN notes n ON p.note_id = n.id
  WHERE p.last_seen > NOW() - INTERVAL '2 minutes'
    AND (p_note_id IS NULL OR p.note_id = p_note_id)
    AND (
      n.user_id = auth.uid()
      OR n.is_public = true
      OR EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = n.workspace_id
        AND wm.user_id = auth.uid()
      )
    );
END;
$$;

-- Function: Get user workspaces (replaces user_workspaces view)
CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_description TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.description as workspace_description,
    wm.role,
    w.created_at,
    w.updated_at
  FROM workspaces w
  INNER JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid();
END;
$$;

-- Function: Get workspace stats (replaces workspace_stats view)
CREATE OR REPLACE FUNCTION get_workspace_stats(p_workspace_id UUID)
RETURNS TABLE (
  workspace_id UUID,
  total_notes BIGINT,
  total_members BIGINT,
  total_canvases BIGINT,
  last_activity TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has access to workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    p_workspace_id,
    COUNT(DISTINCT n.id) as total_notes,
    COUNT(DISTINCT wm.user_id) as total_members,
    COUNT(DISTINCT c.id) as total_canvases,
    MAX(GREATEST(
      COALESCE(MAX(n.updated_at), '1970-01-01'::timestamptz),
      COALESCE(MAX(c.updated_at), '1970-01-01'::timestamptz)
    )) as last_activity
  FROM workspaces w
  LEFT JOIN notes n ON n.workspace_id = w.id
  LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
  LEFT JOIN canvases c ON c.workspace_id = w.id
  WHERE w.id = p_workspace_id
  GROUP BY p_workspace_id;
END;
$$;

-- Function: Get note links with details (replaces note_links_with_details view)
CREATE OR REPLACE FUNCTION get_note_links_with_details(p_note_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  source_note_id UUID,
  target_note_id UUID,
  link_type TEXT,
  strength NUMERIC,
  created_at TIMESTAMPTZ,
  source_title TEXT,
  target_title TEXT,
  source_summary TEXT,
  target_summary TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.id,
    nl.source_note_id,
    nl.target_note_id,
    nl.link_type,
    nl.strength,
    nl.created_at,
    n1.original_notes as source_title,
    n2.original_notes as target_title,
    n1.summary as source_summary,
    n2.summary as target_summary
  FROM note_links nl
  INNER JOIN notes n1 ON nl.source_note_id = n1.id
  INNER JOIN notes n2 ON nl.target_note_id = n2.id
  WHERE (p_note_id IS NULL OR nl.source_note_id = p_note_id OR nl.target_note_id = p_note_id)
    AND (
      n1.user_id = auth.uid() OR n1.is_public = true
    )
    AND (
      n2.user_id = auth.uid() OR n2.is_public = true
    );
END;
$$;

-- Function: Get user analytics summary (replaces user_analytics_summary view)
CREATE OR REPLACE FUNCTION get_user_analytics_summary()
RETURNS TABLE (
  user_id UUID,
  total_notes BIGINT,
  total_summaries BIGINT,
  total_tags BIGINT,
  avg_sentiment NUMERIC,
  last_activity TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as user_id,
    COUNT(DISTINCT n.id) as total_notes,
    COUNT(DISTINCT CASE WHEN n.summary IS NOT NULL THEN n.id END) as total_summaries,
    COUNT(DISTINCT nt.tag_id) as total_tags,
    AVG(n.sentiment) as avg_sentiment,
    MAX(n.created_at) as last_activity
  FROM notes n
  LEFT JOIN note_tags nt ON nt.note_id = n.id
  WHERE n.user_id = auth.uid()
  GROUP BY auth.uid();
END;
$$;

-- =====================================================
-- 3. GRANT EXECUTE PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_comment_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_presence TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_workspaces TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_note_links_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_analytics_summary TO authenticated;

-- =====================================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION get_comment_details IS 'Securely retrieves comment details with user information. Only returns comments from notes the authenticated user can access.';
COMMENT ON FUNCTION get_active_presence IS 'Securely retrieves active presence information. Only returns presence for notes the authenticated user can access.';
COMMENT ON FUNCTION get_user_workspaces IS 'Securely retrieves workspaces for the authenticated user.';
COMMENT ON FUNCTION get_workspace_stats IS 'Securely retrieves statistics for a workspace. Requires workspace membership.';
COMMENT ON FUNCTION get_note_links_with_details IS 'Securely retrieves note links with details. Only returns links for notes the authenticated user can access.';
COMMENT ON FUNCTION get_user_analytics_summary IS 'Securely retrieves analytics summary for the authenticated user.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All insecure views have been replaced with secure functions.
-- Client code will need to be updated to call these functions instead of querying views.
