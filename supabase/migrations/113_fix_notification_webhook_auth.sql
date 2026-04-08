-- Migration: 113_fix_notification_webhook_auth.sql
-- El trigger pg_net llamaba a la edge function sin Authorization header → 401.
-- Fix: leer el service_role_key de notification_config y enviarlo como Bearer token.
--
-- Paso 1 (SQL manual): insertar el service role key en notification_config:
--   INSERT INTO notification_config (key, value)
--   VALUES ('supabase_service_role_key', '<tu_service_role_key>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- Paso 2: esta migración actualiza la función trigger para leerlo y adjuntarlo.

CREATE OR REPLACE FUNCTION trigger_notification_send_to_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  v_url        TEXT;
  v_secret     TEXT;
  v_body       JSONB;
  v_headers    JSONB;
  v_request_id BIGINT;
BEGIN
  SELECT value INTO v_url    FROM notification_config WHERE key = 'edge_function_url';
  SELECT value INTO v_secret FROM notification_config WHERE key = 'supabase_service_role_key';

  IF v_url IS NULL OR v_url = '' THEN
    RAISE WARNING 'notification_config.edge_function_url not set, skipping webhook';
    RETURN NEW;
  END IF;

  v_body := jsonb_build_object(
    'type',       'INSERT',
    'table',      'notification_queue',
    'schema',     'public',
    'record',     to_jsonb(NEW),
    'old_record', NULL
  );

  -- Incluir Authorization si el service role key está configurado
  IF v_secret IS NOT NULL AND v_secret <> '' THEN
    v_headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    );
  ELSE
    v_headers := '{"Content-Type": "application/json"}'::jsonb;
  END IF;

  SELECT net.http_post(
    url                  := v_url,
    body                 := v_body,
    params               := '{}'::jsonb,
    headers              := v_headers,
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
