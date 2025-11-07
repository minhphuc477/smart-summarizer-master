-- =====================================================
-- Webhooks System Migration
-- =====================================================
-- This migration adds webhook functionality to allow users to receive
-- real-time notifications when events occur in their account.
--
-- Features:
-- - Webhook endpoint management (create, update, delete)
-- - Event subscriptions (note.created, note.updated, etc.)
-- - Delivery tracking with retry logic
-- - HMAC-SHA256 signature verification
-- - Automatic cleanup of old deliveries
-- =====================================================

-- =====================================================
-- 1. Create webhooks table
-- =====================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Webhook configuration
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- Used for HMAC signature
  description TEXT,
  
  -- Events to subscribe to
  events TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['note.created', 'note.updated', 'note.deleted']
  
  -- Filtering (optional)
  filters JSONB DEFAULT '{}', -- e.g., {"folder_id": "uuid", "tags": ["meeting"]}
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Delivery settings
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 10,
  
  -- Statistics
  last_triggered_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- =====================================================
-- 2. Create webhook_deliveries table
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  
  -- Event information
  event_type TEXT NOT NULL, -- e.g., 'note.created'
  event_data JSONB NOT NULL,
  
  -- Delivery attempt
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  
  -- Request/Response
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed, cancelled
  error_message TEXT,
  
  -- Timing
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
CREATE INDEX idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at) 
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- =====================================================
-- 3. Create webhook event types enum (for documentation)
-- =====================================================

COMMENT ON TABLE webhooks IS 'Webhook endpoints for real-time event notifications

Supported event types:
- note.created: New note created
- note.updated: Note modified
- note.deleted: Note removed
- folder.created: New folder created
- folder.updated: Folder modified
- folder.deleted: Folder removed
- comment.created: Comment added to note
- comment.updated: Comment modified
- comment.deleted: Comment removed

Event payload format:
{
  "event": "note.created",
  "timestamp": "2025-11-01T10:00:00Z",
  "data": { ... event-specific data ... },
  "user_id": "uuid"
}

Webhook signature:
Each webhook delivery includes an X-Webhook-Signature header with HMAC-SHA256:
X-Webhook-Signature: sha256=<hex_digest>
Computed as: HMAC-SHA256(secret, request_body)
';

-- =====================================================
-- 4. Create function to generate webhook signature
-- =====================================================

CREATE OR REPLACE FUNCTION generate_webhook_signature(
  webhook_secret TEXT,
  payload TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- Generate HMAC-SHA256 signature
  RETURN 'sha256=' || encode(
    hmac(payload::bytea, webhook_secret::bytea, 'sha256'),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 5. Create function to trigger webhook
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_webhook(
  p_event_type TEXT,
  p_event_data JSONB,
  p_user_id UUID
)
RETURNS void AS $$
DECLARE
  webhook_record RECORD;
  delivery_id UUID;
BEGIN
  -- Find all active webhooks for this user subscribed to this event
  FOR webhook_record IN
    SELECT id, url, secret, retry_attempts, timeout_seconds, filters
    FROM webhooks
    WHERE user_id = p_user_id
      AND is_active = true
      AND p_event_type = ANY(events)
  LOOP
    -- Check if filters match (if any filters are specified)
    IF webhook_record.filters IS NOT NULL AND webhook_record.filters != '{}'::jsonb THEN
      -- Simple filter matching (can be extended)
      IF webhook_record.filters ? 'folder_id' THEN
        IF NOT (p_event_data->>'folder_id' = webhook_record.filters->>'folder_id') THEN
          CONTINUE; -- Skip this webhook
        END IF;
      END IF;
    END IF;

    -- Create delivery record
    INSERT INTO webhook_deliveries (
      webhook_id,
      event_type,
      event_data,
      max_attempts,
      scheduled_at
    )
    VALUES (
      webhook_record.id,
      p_event_type,
      jsonb_build_object(
        'event', p_event_type,
        'timestamp', now(),
        'data', p_event_data,
        'user_id', p_user_id
      ),
      webhook_record.retry_attempts,
      now()
    )
    RETURNING id INTO delivery_id;

    -- Update webhook statistics
    UPDATE webhooks
    SET 
      last_triggered_at = now(),
      total_deliveries = total_deliveries + 1,
      updated_at = now()
    WHERE id = webhook_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Create function to cleanup old deliveries
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries()
RETURNS void AS $$
BEGIN
  -- Delete successful deliveries older than 30 days
  DELETE FROM webhook_deliveries
  WHERE status = 'success'
    AND delivered_at < now() - INTERVAL '30 days';

  -- Delete failed deliveries older than 90 days
  DELETE FROM webhook_deliveries
  WHERE status = 'failed'
    AND created_at < now() - INTERVAL '90 days';

  -- Delete cancelled deliveries older than 7 days
  DELETE FROM webhook_deliveries
  WHERE status = 'cancelled'
    AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Create triggers for automatic webhook firing
-- =====================================================

-- Trigger when note is created
CREATE OR REPLACE FUNCTION notify_note_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_webhook(
    'note.created',
    to_jsonb(NEW),
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_created
  AFTER INSERT ON notes
  FOR EACH ROW
  EXECUTE FUNCTION notify_note_created();

-- Trigger when note is updated
CREATE OR REPLACE FUNCTION notify_note_updated()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_webhook(
    'note.updated',
    jsonb_build_object(
      'id', NEW.id,
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ),
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_updated
  AFTER UPDATE ON notes
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION notify_note_updated();

-- Trigger when note is deleted
CREATE OR REPLACE FUNCTION notify_note_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_webhook(
    'note.deleted',
    to_jsonb(OLD),
    OLD.user_id
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_note_deleted
  AFTER DELETE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION notify_note_deleted();

-- =====================================================
-- 8. Row Level Security (RLS)
-- =====================================================

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Webhooks policies
CREATE POLICY "Users can view their own webhooks"
  ON webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhooks"
  ON webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks"
  ON webhooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhooks"
  ON webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- Webhook deliveries policies
CREATE POLICY "Users can view deliveries for their webhooks"
  ON webhook_deliveries FOR SELECT
  USING (
    webhook_id IN (
      SELECT id FROM webhooks WHERE user_id = auth.uid()
    )
  );

-- Service role can manage all deliveries (for background processing)
CREATE POLICY "Service role can manage all deliveries"
  ON webhook_deliveries FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =====================================================
-- 9. Grant permissions
-- =====================================================

GRANT ALL ON webhooks TO authenticated;
GRANT ALL ON webhook_deliveries TO authenticated;
GRANT ALL ON webhooks TO service_role;
GRANT ALL ON webhook_deliveries TO service_role;

-- =====================================================
-- 10. Create function to increment webhook statistics
-- =====================================================

CREATE OR REPLACE FUNCTION increment_webhook_stats(
  webhook_id UUID,
  success BOOLEAN
)
RETURNS void AS $$
BEGIN
  IF success THEN
    UPDATE webhooks
    SET 
      successful_deliveries = successful_deliveries + 1,
      updated_at = now()
    WHERE id = webhook_id;
  ELSE
    UPDATE webhooks
    SET 
      failed_deliveries = failed_deliveries + 1,
      updated_at = now()
    WHERE id = webhook_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. Create updated_at trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_deliveries_updated_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 12. Create sample data (for testing)
-- =====================================================

-- Note: This is commented out for production. Uncomment for local testing.
/*
INSERT INTO webhooks (user_id, url, secret, events, description)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'https://example.com/webhook',
  'test_secret_key',
  ARRAY['note.created', 'note.updated'],
  'Test webhook for note events'
);
*/

-- =====================================================
-- Migration Complete
-- =====================================================

-- Summary:
-- ✓ Created webhooks table for endpoint management
-- ✓ Created webhook_deliveries table for tracking
-- ✓ Added functions for signature generation and triggering
-- ✓ Created triggers for automatic webhook firing on note events
-- ✓ Implemented RLS policies for security
-- ✓ Added cleanup function for old deliveries
-- ✓ Created indexes for performance

-- =====================================================
-- 13. Add claim/complete RPCs for background dispatcher
-- =====================================================

-- Atomically claim a batch of pending deliveries for processing
CREATE OR REPLACE FUNCTION claim_pending_deliveries(
  p_limit INT DEFAULT 10
) RETURNS TABLE (
  delivery_id UUID,
  webhook_id UUID,
  user_id UUID,
  url TEXT,
  secret TEXT,
  event_type TEXT,
  event_data JSONB,
  attempt_number INT,
  max_attempts INT,
  timeout_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH to_claim AS (
    SELECT d.id
    FROM webhook_deliveries d
    JOIN webhooks w ON w.id = d.webhook_id
    WHERE d.status IN ('pending')
      AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
      AND w.is_active = true
    ORDER BY d.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE webhook_deliveries d
    SET status = 'processing', attempt_number = d.attempt_number + 1, updated_at = now()
    FROM to_claim
    WHERE d.id = to_claim.id
    RETURNING d.id, d.webhook_id, d.event_type, d.event_data, d.attempt_number, d.max_attempts
  )
  SELECT 
    u.id AS delivery_id,
    u.webhook_id,
    w.user_id,
    w.url,
    w.secret,
    u.event_type,
    u.event_data,
    u.attempt_number,
    u.max_attempts,
    w.timeout_seconds
  FROM updated u
  JOIN webhooks w ON w.id = u.webhook_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_deliveries(INT) TO service_role;

-- Mark a delivery as success or schedule retry/failure
CREATE OR REPLACE FUNCTION complete_delivery(
  p_delivery_id UUID,
  p_success BOOLEAN,
  p_response_status INT,
  p_response_body TEXT,
  p_error_message TEXT,
  p_next_retry_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook_id UUID;
  v_attempt_number INT;
  v_max_attempts INT;
BEGIN
  SELECT webhook_id, attempt_number, max_attempts INTO v_webhook_id, v_attempt_number, v_max_attempts
  FROM webhook_deliveries
  WHERE id = p_delivery_id;

  IF p_success THEN
    UPDATE webhook_deliveries
    SET status = 'success',
        response_status = p_response_status,
        response_body = p_response_body,
        delivered_at = now(),
        updated_at = now()
    WHERE id = p_delivery_id;

    PERFORM increment_webhook_stats(v_webhook_id, true);
  ELSE
    UPDATE webhook_deliveries
    SET status = CASE WHEN v_attempt_number >= v_max_attempts OR p_next_retry_at IS NULL THEN 'failed' ELSE 'pending' END,
        response_status = p_response_status,
        response_body = p_response_body,
        error_message = p_error_message,
        next_retry_at = p_next_retry_at,
        updated_at = now()
    WHERE id = p_delivery_id;

    PERFORM increment_webhook_stats(v_webhook_id, false);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_delivery(UUID, BOOLEAN, INT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
