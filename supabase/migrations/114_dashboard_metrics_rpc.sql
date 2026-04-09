-- Migration: 114_dashboard_metrics_rpc.sql
-- Server-side aggregation for dashboard metrics.
-- Eliminates fetching rows to the client just to sum/count them.

-- ============================================================
-- 1) Indexes missing for dashboard queries
-- ============================================================

-- New customers per month
CREATE INDEX IF NOT EXISTS idx_customers_org_created_at
  ON public.customers (organization_id, created_at DESC);

-- Low-stock product scan (partial: only active products)
CREATE INDEX IF NOT EXISTS idx_products_org_active_stock
  ON public.products (organization_id, stock, min_stock, low_stock_threshold)
  WHERE is_active = true;

-- Low-stock variant scan (partial: only active variants)
CREATE INDEX IF NOT EXISTS idx_product_variants_active_stock
  ON public.product_variants (product_id, stock, min_stock, low_stock_threshold)
  WHERE is_active = true;

-- ============================================================
-- 2) Money metrics RPC
--    Returns revenue, orders, margin and ticket avg for the
--    current month and the equivalent prior-month period.
--    All aggregation happens in Postgres — 0 rows sent to client.
--    NOTE: status is cast to text to compare against TEXT[].
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_money_metrics(
  p_organization_id  UUID,
  p_month_start      TIMESTAMPTZ,
  p_prev_start       TIMESTAMPTZ,
  p_prev_end         TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result           JSONB;
  v_completed TEXT[] := ARRAY['delivered', 'shipped', 'processing'];
BEGIN
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  WITH
  month_orders AS (
    SELECT id, total
    FROM public.orders
    WHERE organization_id = p_organization_id
      AND status::text    = ANY(v_completed)
      AND created_at     >= p_month_start
  ),
  prev_orders AS (
    SELECT id, total
    FROM public.orders
    WHERE organization_id = p_organization_id
      AND status::text    = ANY(v_completed)
      AND created_at     >= p_prev_start
      AND created_at     <= p_prev_end
  ),
  month_agg AS (
    SELECT
      COALESCE(SUM(total), 0)::NUMERIC AS revenue,
      COUNT(*)::BIGINT                 AS orders
    FROM month_orders
  ),
  prev_agg AS (
    SELECT
      COALESCE(SUM(total), 0)::NUMERIC AS revenue,
      COUNT(*)::BIGINT                 AS orders
    FROM prev_orders
  ),
  month_margin AS (
    SELECT COALESCE(SUM(oi.margin_at_sale), 0)::NUMERIC AS amount
    FROM public.order_items oi
    INNER JOIN month_orders mo ON mo.id = oi.order_id
    WHERE oi.margin_at_sale IS NOT NULL
  ),
  prev_margin AS (
    SELECT COALESCE(SUM(oi.margin_at_sale), 0)::NUMERIC AS amount
    FROM public.order_items oi
    INNER JOIN prev_orders po ON po.id = oi.order_id
    WHERE oi.margin_at_sale IS NOT NULL
  )
  SELECT jsonb_build_object(
    'month_revenue',                  ma.revenue,
    'month_orders',                   ma.orders,
    'month_avg_order_value',          CASE WHEN ma.orders > 0 THEN ma.revenue / ma.orders ELSE 0 END,
    'month_gross_margin_amount',      mm.amount,
    'month_gross_margin_pct',         CASE WHEN ma.revenue > 0 THEN mm.amount / ma.revenue * 100 ELSE 0 END,
    'prev_month_revenue',             pa.revenue,
    'prev_month_orders',              pa.orders,
    'prev_month_avg_order_value',     CASE WHEN pa.orders > 0 THEN pa.revenue / pa.orders ELSE 0 END,
    'prev_month_gross_margin_amount', pm.amount,
    'prev_month_gross_margin_pct',    CASE WHEN pa.revenue > 0 THEN pm.amount / pa.revenue * 100 ELSE 0 END
  )
  INTO v_result
  FROM month_agg ma, prev_agg pa, month_margin mm, prev_margin pm;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 3) Operational metrics RPC
--    Returns order counts, pending, low-stock and new customers.
--    Uses COUNT-only queries — no rows transferred.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_operational_metrics(
  p_organization_id  UUID,
  p_month_start      TIMESTAMPTZ,
  p_prev_start       TIMESTAMPTZ,
  p_prev_end         TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed   TEXT[] := ARRAY['delivered', 'shipped', 'processing'];
  v_pending     TEXT[] := ARRAY['pending', 'pending_allocation'];
  v_month_orders        BIGINT;
  v_prev_orders         BIGINT;
  v_pending_orders      BIGINT;
  v_low_products        BIGINT;
  v_low_variants        BIGINT;
  v_new_customers       BIGINT;
  v_prev_new_customers  BIGINT;
BEGIN
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  SELECT COUNT(*) INTO v_month_orders
  FROM public.orders
  WHERE organization_id = p_organization_id
    AND status::text    = ANY(v_completed)
    AND created_at     >= p_month_start;

  SELECT COUNT(*) INTO v_prev_orders
  FROM public.orders
  WHERE organization_id = p_organization_id
    AND status::text    = ANY(v_completed)
    AND created_at     >= p_prev_start
    AND created_at     <= p_prev_end;

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.orders
  WHERE organization_id = p_organization_id
    AND status::text    = ANY(v_pending);

  SELECT COUNT(*) INTO v_low_products
  FROM public.products
  WHERE organization_id = p_organization_id
    AND is_active = true
    AND (stock <= min_stock OR stock <= low_stock_threshold);

  SELECT COUNT(*) INTO v_low_variants
  FROM public.product_variants pv
  INNER JOIN public.products p ON p.id = pv.product_id
  WHERE p.organization_id = p_organization_id
    AND pv.is_active = true
    AND (pv.stock <= pv.min_stock OR pv.stock <= pv.low_stock_threshold);

  SELECT COUNT(*) INTO v_new_customers
  FROM public.customers
  WHERE organization_id = p_organization_id
    AND created_at >= p_month_start;

  SELECT COUNT(*) INTO v_prev_new_customers
  FROM public.customers
  WHERE organization_id = p_organization_id
    AND created_at >= p_prev_start
    AND created_at <= p_prev_end;

  RETURN jsonb_build_object(
    'month_orders',             v_month_orders,
    'prev_month_orders',        v_prev_orders,
    'pending_orders',           v_pending_orders,
    'low_stock_count',          v_low_products + v_low_variants,
    'new_customers',            v_new_customers,
    'prev_month_new_customers', v_prev_new_customers
  );
END;
$$;
