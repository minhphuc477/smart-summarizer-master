-- Phase 6: Public API - Database Migration
-- Date: November 1, 2025
-- Purpose: Add tables for API key management and usage tracking

-- =============================================
-- 1. API Keys Table
-- =============================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "sk_live_")
  scopes TEXT[] DEFAULT ARRAY['read', 'write']::TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  
  CONSTRAINT api_keys_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  CONSTRAINT api_keys_key_prefix_length CHECK (char_length(key_prefix) = 8)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON public.api_keys(created_at DESC);

-- =============================================
-- 2. API Usage Logs Table
-- =============================================

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT api_usage_logs_method_check CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  CONSTRAINT api_usage_logs_status_code_check CHECK (status_code >= 100 AND status_code < 600)
);

-- Indexes for performance (time-series queries)
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON public.api_usage_logs(endpoint);

-- Composite index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_rate_limit 
  ON public.api_usage_logs(api_key_id, created_at DESC);

-- =============================================
-- 3. RLS Policies for API Keys
-- =============================================

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own API keys
CREATE POLICY "Users can view own API keys"
  ON public.api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own API keys"
  ON public.api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys (name, is_active, expires_at)
CREATE POLICY "Users can update own API keys"
  ON public.api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys"
  ON public.api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 4. RLS Policies for API Usage Logs
-- =============================================

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view usage logs for their own API keys
CREATE POLICY "Users can view own API usage logs"
  ON public.api_usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.api_keys
      WHERE api_keys.id = api_usage_logs.api_key_id
        AND api_keys.user_id = auth.uid()
    )
  );

-- Service role can insert usage logs (called from API middleware)
CREATE POLICY "Service role can insert usage logs"
  ON public.api_usage_logs
  FOR INSERT
  WITH CHECK (TRUE); -- Service role bypasses RLS, but explicit policy for clarity

-- =============================================
-- 5. Helper Function: Generate API Key
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_api_key_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  random_bytes BYTEA;
  api_key TEXT;
BEGIN
  -- Generate 32 random bytes (256 bits)
  random_bytes := gen_random_bytes(32);
  
  -- Encode as base64 and create API key format
  api_key := 'sk_live_' || encode(random_bytes, 'base64');
  
  -- Remove base64 padding and unwanted characters
  api_key := REPLACE(REPLACE(REPLACE(api_key, '+', ''), '/', ''), '=', '');
  
  RETURN api_key;
END;
$$;

-- =============================================
-- 6. Helper Function: Hash API Key
-- =============================================

CREATE OR REPLACE FUNCTION public.hash_api_key(api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(digest(api_key, 'sha256'), 'hex');
END;
$$;

-- =============================================
-- 7. Helper Function: Validate API Key
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_api_key(api_key TEXT)
RETURNS TABLE (
  key_id UUID,
  user_id UUID,
  scopes TEXT[],
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_hash_input TEXT;
BEGIN
  -- Hash the input key
  key_hash_input := public.hash_api_key(api_key);
  
  -- Look up the key
  RETURN QUERY
  SELECT 
    k.id,
    k.user_id,
    k.scopes,
    CASE
      WHEN k.is_active = FALSE THEN FALSE
      WHEN k.expires_at IS NOT NULL AND k.expires_at < NOW() THEN FALSE
      ELSE TRUE
    END AS is_valid
  FROM public.api_keys k
  WHERE k.key_hash = key_hash_input;
  
  -- Update last_used_at
  UPDATE public.api_keys
  SET last_used_at = NOW()
  WHERE key_hash = key_hash_input
    AND is_active = TRUE;
    
END;
$$;

-- =============================================
-- 8. Trigger: Auto-delete old usage logs
-- =============================================

-- Function to delete logs older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_old_api_usage_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.api_usage_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Create a scheduled job (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-api-logs', '0 2 * * *', 'SELECT public.cleanup_old_api_usage_logs()');

-- =============================================
-- 9. Comments
-- =============================================

COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access to Smart Summarizer';
COMMENT ON TABLE public.api_usage_logs IS 'Usage tracking and rate limiting for API requests';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the API key for secure storage';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters of key for display (e.g., sk_live_)';
COMMENT ON COLUMN public.api_keys.scopes IS 'Permissions: read, write, delete, admin';
COMMENT ON COLUMN public.api_usage_logs.response_time_ms IS 'API response time in milliseconds';

-- =============================================
-- 10. Grant Permissions
-- =============================================

-- Grant usage on tables to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT SELECT ON public.api_usage_logs TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.generate_api_key_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(TEXT) TO service_role;

-- =============================================
-- Migration Complete
-- =============================================

-- Verify tables exist
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('api_keys', 'api_usage_logs')) = 2,
         'API tables not created successfully';
  
  RAISE NOTICE 'Phase 6 API migration completed successfully';
END $$;
