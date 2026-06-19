-- Migration: 135_pg_cron_stale_orders_notifier.sql
--
-- Crea:
--   1. Tabla stale_order_notification_logs — deduplicación para no spamear al merchant
--   2. Función get_stale_orders_summary()  — agrega conteos de órdenes stuck por org
--   3. Cron job cada 1 hora que dispara la Edge Function stale-orders-notifier
--
-- La función solo devuelve orgs que tienen Twilio configurado via
-- settings.daily_summary (phone + enabled = true), para no intentar notificar
-- a orgs que no lo han activado.

-- ============================================================
-- 1. Tabla de logs para deduplicación (una notificación por org cada 6h)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stale_order_notification_logs (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pending_allocation_count INT         NOT NULL DEFAULT 0,
  pending_payment_count    INT         NOT NULL DEFAULT 0,
  stuck_processing_count   INT         NOT NULL DEFAULT 0,
  twilio_sid               TEXT,
  sent_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stale_order_logs_org_sent
  ON public.stale_order_notification_logs(organization_id, sent_at DESC);

ALTER TABLE public.stale_order_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admins_select_stale_logs"
  ON public.stale_order_notification_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 2. Función auxiliar: get_stale_orders_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stale_orders_summary()
RETURNS TABLE (
  organization_id          UUID,
  org_name                 TEXT,
  twilio_phone             TEXT,
  twilio_channel           TEXT,
  pending_allocation_count BIGINT,
  pending_payment_count    BIGINT,
  stuck_processing_count   BIGINT
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT
    o.id                                                            AS organization_id,
    o.name                                                          AS org_name,
    o.settings->'daily_summary'->>'phone'                           AS twilio_phone,
    COALESCE(o.settings->'daily_summary'->>'channel', 'whatsapp')  AS twilio_channel,
    COUNT(*) FILTER (
      WHERE ord.status = 'pending_allocation'
        AND ord.created_at < NOW() - INTERVAL '24 hours'
    )                                                               AS pending_allocation_count,
    COUNT(*) FILTER (
      WHERE ord.status = 'pending'
        AND ord.payment_method != 'mercadopago'
        AND ord.created_at < NOW() - INTERVAL '2 hours'
    )                                                               AS pending_payment_count,
    COUNT(*) FILTER (
      WHERE ord.status = 'processing'
        AND ord.created_at < NOW() - INTERVAL '7 days'
    )                                                               AS stuck_processing_count
  FROM public.organizations o
  JOIN public.orders ord ON ord.organization_id = o.id
  WHERE
    -- Solo incluir orgs con Twilio configurado
    (o.settings->'daily_summary'->>'enabled')::boolean = true
    AND o.settings->'daily_summary'->>'phone' IS NOT NULL
    AND o.settings->'daily_summary'->>'phone' != ''
    -- Solo filas con al menos un caso stuck
    AND (
      (ord.status = 'pending_allocation' AND ord.created_at < NOW() - INTERVAL '24 hours')
      OR (ord.status = 'pending' AND ord.payment_method != 'mercadopago' AND ord.created_at < NOW() - INTERVAL '2 hours')
      OR (ord.status = 'processing' AND ord.created_at < NOW() - INTERVAL '7 days')
    )
  GROUP BY o.id, o.name, o.settings
  HAVING COUNT(*) > 0
$$;

-- ============================================================
-- 3. pg_cron: cada hora
-- ============================================================
SELECT cron.schedule(
  'stale-orders-notifier',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/stale-orders-notifier',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )
  $$
);
