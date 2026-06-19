-- Migration: 133_pg_cron_abandoned_cart_cleanup.sql
--
-- Crea la función auxiliar get_abandoned_mp_orders() y el cron job que dispara
-- la Edge Function abandoned-cart-cleanup cada 6 horas.
--
-- Candidatas: órdenes pending + MP + sin mp_payment_id + created_at > 24h.
-- La función excluye el rango < 24h porque ese lo maneja mp-payment-reconciler.

-- ============================================================
-- 1. Función auxiliar: get_abandoned_mp_orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_abandoned_mp_orders()
RETURNS TABLE (
  order_id        UUID,
  organization_id UUID,
  payment_row_id  UUID,
  access_token    TEXT
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT
    o.id                          AS order_id,
    o.organization_id             AS organization_id,
    op.id                         AS payment_row_id,
    opm.config->>'access_token'   AS access_token
  FROM order_payments op
  JOIN orders o
    ON o.id = op.order_id
  JOIN organization_payment_methods opm
    ON opm.organization_id = o.organization_id
    AND opm.key            = 'mercadopago'
    AND opm.is_active      = true
  WHERE op.payment_method        = 'mercadopago'
    AND op.mp_payment_id        IS NULL
    AND o.status                 = 'pending'
    AND o.created_at             < NOW() - INTERVAL '24 hours'
    AND opm.config->>'access_token' IS NOT NULL
  ORDER BY o.created_at ASC
  LIMIT 100
$$;

-- ============================================================
-- 2. pg_cron: cada 6 horas
-- ============================================================
SELECT cron.schedule(
  'abandoned-cart-cleanup',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/abandoned-cart-cleanup',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )
  $$
);
