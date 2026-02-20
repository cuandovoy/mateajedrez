-- Migration: 055_notification_webhook_trigger.sql
-- Trigger to invoke Edge Function when a notification is queued.
-- Requires: pg_net extension (enabled by default in Supabase)
--
-- IMPORTANT: Set the Edge Function URL for your deployment.
-- For Supabase Cloud: https://<project-ref>.supabase.co/functions/v1/send-notification
-- For local dev: http://127.0.0.1:54321/functions/v1/send-notification
-- Run: UPDATE notification_config SET value = 'YOUR_URL' WHERE key = 'edge_function_url';

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Config table for notification webhook URL (allows per-deployment config)
CREATE TABLE IF NOT EXISTS notification_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default: local Supabase Edge Functions URL (user should update for production)
INSERT INTO notification_config (key, value)
VALUES ('edge_function_url', 'http://127.0.0.1:54321/functions/v1/send-notification')
ON CONFLICT (key) DO NOTHING;

-- Trigger function: call Edge Function on notification_queue INSERT
CREATE OR REPLACE FUNCTION trigger_notification_send_to_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT;
  v_body JSONB;
  v_request_id BIGINT;
BEGIN
  SELECT value INTO v_url FROM notification_config WHERE key = 'edge_function_url';
  IF v_url IS NULL OR v_url = '' THEN
    RAISE WARNING 'notification_config.edge_function_url not set, skipping webhook';
    RETURN NEW;
  END IF;

  v_body := jsonb_build_object(
    'type', 'INSERT',
    'table', 'notification_queue',
    'schema', 'public',
    'record', to_jsonb(NEW),
    'old_record', NULL
  );

  SELECT net.http_post(
    url := v_url,
    body := v_body,
    params := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notification_queue_webhook
  AFTER INSERT ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notification_send_to_edge_function();
