-- Migration: 132_pg_cron_mp_payment_reconciler.sql
--
-- Crea la función auxiliar get_stuck_mp_orders() y el cron job que dispara
-- la Edge Function mp-payment-reconciler cada 15 minutos.
--
-- La función devuelve órdenes en estado 'pending' con un placeholder de pago
-- MP (mp_payment_id IS NULL) cuya antigüedad está entre 10 minutos y 24 horas.
--   - < 10 min: se da tiempo al IPN normal para que llegue
--   - > 24 h:   las maneja abandoned-cart-cleanup (item 03)

-- ============================================================
-- 1. Función auxiliar: get_stuck_mp_orders
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stuck_mp_orders()
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
    o.id                                AS order_id,
    o.organization_id                   AS organization_id,
    op.id                               AS payment_row_id,
    opm.config->>'access_token'         AS access_token
  FROM order_payments op
  JOIN orders o
    ON o.id = op.order_id
  JOIN organization_payment_methods opm
    ON opm.organization_id = o.organization_id
    AND opm.key            = 'mercadopago'
    AND opm.is_active      = true
  WHERE op.payment_method  = 'mercadopago'
    AND op.mp_payment_id  IS NULL
    AND o.status           = 'pending'
    AND o.created_at       < NOW() - INTERVAL '10 minutes'
    AND o.created_at       > NOW() - INTERVAL '24 hours'
    AND opm.config->>'access_token' IS NOT NULL
  ORDER BY o.created_at ASC
  LIMIT 50
$$;

-- ============================================================
-- 2. pg_cron: cada 15 minutos
-- ============================================================
SELECT cron.schedule(
  'mp-payment-reconciler',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/mp-payment-reconciler',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )
  $$
);
