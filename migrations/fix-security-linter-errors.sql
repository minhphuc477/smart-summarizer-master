-- Fix Supabase Security Linter Errors
-- Addresses:
-- 1. auth_users_exposed: public.users view exposes auth.users
-- 2. security_definer_view: public.users defined with SECURITY DEFINER
-- 3. rls_disabled_in_public: embedding_jobs and embedding_metrics lack RLS

-- ==========================================
-- 1. Fix public.users view exposure
-- ==========================================

-- Drop the existing insecure view
DROP VIEW IF EXISTS public.users CASCADE;

-- Recreate with SECURITY INVOKER (default, safer than DEFINER)
-- and only expose safe, non-sensitive fields
CREATE OR REPLACE VIEW public.users
WITH (security_invoker=true)
AS
SELECT 
  id,
  email,
  -- Only expose safe metadata fields
  (raw_user_meta_data->>'name') as name,
  (raw_user_meta_data->>'avatar_url') as avatar_url,
  created_at,
  last_sign_in_at
FROM auth.users;

COMMENT ON VIEW public.users IS 
'Safe view of auth.users with SECURITY INVOKER - only exposes non-sensitive fields';

-- Revoke anon access (only authenticated users should see other users)
REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;

-- ==========================================
-- 2. Enable RLS on embedding_jobs
-- ==========================================

ALTER TABLE public.embedding_jobs ENABLE ROW LEVEL SECURITY;

-- Only service role and authenticated users can read their own note's jobs
DROP POLICY IF EXISTS "Users can read embedding jobs for their notes" ON public.embedding_jobs;
CREATE POLICY "Users can read embedding jobs for their notes"
  ON public.embedding_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = embedding_jobs.note_id 
        AND n.user_id = auth.uid()
    )
  );

-- Only system/service can insert jobs (API routes use service role)
DROP POLICY IF EXISTS "Service role can manage embedding jobs" ON public.embedding_jobs;
CREATE POLICY "Service role can manage embedding jobs"
  ON public.embedding_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- ==========================================
-- 3. Enable RLS on embedding_metrics
-- ==========================================

ALTER TABLE public.embedding_metrics ENABLE ROW LEVEL SECURITY;

-- Users can read metrics for their own notes
DROP POLICY IF EXISTS "Users can read embedding metrics for their notes" ON public.embedding_metrics;
CREATE POLICY "Users can read embedding metrics for their notes"
  ON public.embedding_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = embedding_metrics.note_id 
        AND n.user_id = auth.uid()
    )
  );

-- Service role can insert metrics
DROP POLICY IF EXISTS "Service role can manage embedding metrics" ON public.embedding_metrics;
CREATE POLICY "Service role can manage embedding metrics"
  ON public.embedding_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- ==========================================
-- Verification queries (optional)
-- ==========================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('embedding_jobs', 'embedding_metrics');

-- Check view security:
-- SELECT viewname, definition 
-- FROM pg_views 
-- WHERE schemaname = 'public' AND viewname = 'users';

-- Check policies:
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('embedding_jobs', 'embedding_metrics', 'users');
