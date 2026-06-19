-- Migration: 136_pg_cron_inventory_drift_auditor.sql
--
-- Crea:
--   1. Tabla inventory_drift_log — registro de discrepancias detectadas (solo lectura, nunca muta stock)
--   2. Función get_inventory_drift()  — compara branch_inventory.stock vs new_stock del último movimiento
--   3. Cron job diario a las 3am que dispara la Edge Function inventory-drift-auditor
--
-- La función devuelve únicamente entradas con al menos un movimiento registrado y con drift != 0.
-- Entradas sin ningún movimiento se ignoran (no hay baseline contra el cual comparar).

-- ============================================================
-- 1. Tabla de auditoría de drift
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_drift_log (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_inventory_id  UUID        NOT NULL REFERENCES public.branch_inventory(id) ON DELETE CASCADE,
  branch_id            UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id           UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id           UUID        REFERENCES public.product_variants(id) ON DELETE SET NULL,
  stock_current        INTEGER     NOT NULL, -- branch_inventory.stock al momento de la detección
  stock_expected       INTEGER     NOT NULL, -- new_stock del último inventory_movements para esta entrada
  drift                INTEGER     NOT NULL, -- stock_current - stock_expected (≠ 0 siempre)
  last_movement_id     UUID        REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  last_movement_at     TIMESTAMPTZ,
  detected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_drift_log_org
  ON public.inventory_drift_log(organization_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_drift_log_branch_inventory
  ON public.inventory_drift_log(branch_inventory_id, detected_at DESC);

ALTER TABLE public.inventory_drift_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admins_select_drift_log"
  ON public.inventory_drift_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 2. Función auxiliar: get_inventory_drift
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_inventory_drift()
RETURNS TABLE (
  organization_id     UUID,
  branch_inventory_id UUID,
  branch_id           UUID,
  product_id          UUID,
  variant_id          UUID,
  stock_current       INTEGER,
  stock_expected      INTEGER,
  drift               INTEGER,
  last_movement_id    UUID,
  last_movement_at    TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.organization_id,
    bi.id                AS branch_inventory_id,
    bi.branch_id,
    bi.product_id,
    bi.variant_id,
    bi.stock             AS stock_current,
    lm.new_stock         AS stock_expected,
    bi.stock - lm.new_stock AS drift,
    lm.id                AS last_movement_id,
    lm.created_at        AS last_movement_at
  FROM public.branch_inventory bi
  JOIN public.branches b ON b.id = bi.branch_id
  -- LATERAL join: toma el movimiento más reciente para esta entrada de inventario
  JOIN LATERAL (
    SELECT id, new_stock, created_at
    FROM public.inventory_movements
    WHERE branch_inventory_id = bi.id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE
    -- Solo entradas con drift real (evita procesar miles de filas sin diferencia)
    bi.stock != lm.new_stock
$$;

-- ============================================================
-- 3. pg_cron: todos los días a las 3am
-- ============================================================
SELECT cron.schedule(
  'inventory-drift-auditor',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/inventory-drift-auditor',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )
  $$
);
