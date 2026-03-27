-- ═══════════════════════════════════════════════════════════════════════════════
-- 104_daily_summary_twilio.sql
-- Resumen diario de ventas y gastos por Twilio (WhatsApp / SMS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Config por defecto en cada organización ───────────────────────────────
-- Agrega bloque daily_summary al JSONB settings de cada org que no lo tenga.

UPDATE public.organizations
SET settings = settings || jsonb_build_object(
  'daily_summary', jsonb_build_object(
    'enabled',   false,
    'phone',     '',
    'send_hour', 20,
    'timezone',  'America/Montevideo',
    'channel',   'whatsapp'
  )
)
WHERE settings->'daily_summary' IS NULL;

-- ─── 2. notification_config: URL de la edge function + service role key ───────
-- Actualizar después del deploy:
--   UPDATE notification_config SET value = 'https://<ref>.supabase.co/functions/v1/daily-sales-summary'
--     WHERE key = 'daily_summary_function_url';
--   UPDATE notification_config SET value = '<service_role_key>'
--     WHERE key = 'supabase_service_role_key';

INSERT INTO notification_config (key, value)
VALUES ('daily_summary_function_url', 'http://127.0.0.1:54321/functions/v1/daily-sales-summary')
ON CONFLICT (key) DO NOTHING;

INSERT INTO notification_config (key, value)
VALUES ('supabase_service_role_key', '')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. Tabla de logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_summary_logs (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date_covered    date          NOT NULL,
  sent_at         timestamptz   NOT NULL DEFAULT now(),
  total_sales     numeric(12,2) NOT NULL DEFAULT 0,
  order_count     integer       NOT NULL DEFAULT 0,
  total_expenses  numeric(12,2) NOT NULL DEFAULT 0,
  phone           text          NOT NULL,
  channel         text          NOT NULL DEFAULT 'whatsapp',
  status          text          NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error           text,
  twilio_sid      text
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_logs_org_date
  ON public.daily_summary_logs(organization_id, date_covered DESC);

-- RLS: solo miembros de la org pueden ver sus logs
ALTER TABLE public.daily_summary_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_daily_summary_logs"
  ON public.daily_summary_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ─── 4. RPC: métricas del día para una organización ──────────────────────────
-- Usado por la edge function para calcular ventas y gastos respetando la zona
-- horaria de la organización.

CREATE OR REPLACE FUNCTION public.get_daily_summary(
  p_organization_id uuid,
  p_date            date,
  p_timezone        text DEFAULT 'UTC'
)
RETURNS TABLE(
  total_sales    numeric,
  order_count    integer,
  total_expenses numeric
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(o.total)::numeric
      FROM public.orders o
      WHERE o.organization_id = p_organization_id
        AND (o.created_at AT TIME ZONE p_timezone)::date = p_date
        AND o.status NOT IN ('cancelled')
    ), 0) AS total_sales,

    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.orders o
      WHERE o.organization_id = p_organization_id
        AND (o.created_at AT TIME ZONE p_timezone)::date = p_date
        AND o.status NOT IN ('cancelled')
    ), 0) AS order_count,

    COALESCE((
      SELECT SUM(el.net_amount)::numeric
      FROM public.expense_ledger el
      WHERE el.organization_id = p_organization_id
        AND (el.occurred_at AT TIME ZONE p_timezone)::date = p_date
        AND el.status = 'posted'
    ), 0) AS total_expenses;
END;
$$;

-- ─── 5. Función que pg_cron llama cada hora ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_daily_summary_edge()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM notification_config WHERE key = 'daily_summary_function_url';
  SELECT value INTO v_key FROM notification_config WHERE key = 'supabase_service_role_key';

  IF v_url IS NULL OR v_url = '' THEN
    RAISE WARNING 'daily_summary_function_url not configured in notification_config';
    RETURN;
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'supabase_service_role_key not configured in notification_config';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := '{"scheduled": true}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trigger_daily_summary_edge falló: % %', SQLERRM, SQLSTATE;
END;
$$;

-- ─── 6. pg_cron: ejecutar cada hora en el minuto 0 ────────────────────────────
-- Requiere extensión pg_cron (disponible en Supabase Cloud).
-- La edge function decide qué orgs enviar según su send_hour y timezone.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-sales-summary-hourly',
  '0 * * * *',
  'SELECT public.trigger_daily_summary_edge()'
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-sales-summary-hourly'
);
