-- Migration: 115_dashboard_trends_rpc.sql
-- Weekly revenue comparison and top products for dashboard trends section.

-- Index to speed up order_items joins for top-products aggregation
CREATE INDEX IF NOT EXISTS idx_order_items_product_margin
  ON public.order_items (product_id, order_id);

CREATE OR REPLACE FUNCTION public.get_dashboard_trends(
  p_organization_id UUID,
  p_month_start     TIMESTAMPTZ,
  p_prev_start      TIMESTAMPTZ,
  p_prev_end        TIMESTAMPTZ,
  p_timezone        TEXT DEFAULT 'America/Montevideo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result   JSONB;
  v_completed TEXT[] := ARRAY['delivered', 'shipped', 'processing'];
BEGIN
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  WITH
  -- Current month orders bucketed by week-of-month in org timezone
  month_orders AS (
    SELECT
      total,
      CASE
        WHEN EXTRACT(DAY FROM created_at AT TIME ZONE p_timezone) <=  7 THEN 1
        WHEN EXTRACT(DAY FROM created_at AT TIME ZONE p_timezone) <= 14 THEN 2
        WHEN EXTRACT(DAY FROM created_at AT TIME ZONE p_timezone) <= 21 THEN 3
        ELSE 4
      END AS week_num
    FROM public.orders
    WHERE organization_id = p_organization_id
      AND status::text    = ANY(v_completed)
      AND created_at     >= p_month_start
  ),
  -- Previous month orders bucketed by week-of-month in org timezone
  prev_orders AS (
    SELECT
      total,
      CASE
        WHEN EXTRACT(DAY FROM created_at AT TIME ZONE p_timezone) <=  7 THEN 1
        WHEN EXTRACT(DAY FROM created_at AT TIME ZONE p_timezone) <= 14 THEN 2
        WHEN EXTRACT(DAY FROM created_at AT TIME ZONE p_timezone) <= 21 THEN 3
        ELSE 4
      END AS week_num
    FROM public.orders
    WHERE organization_id = p_organization_id
      AND status::text    = ANY(v_completed)
      AND created_at     >= p_prev_start
      AND created_at     <= p_prev_end
  ),
  month_weekly AS (
    SELECT week_num, COALESCE(SUM(total), 0)::NUMERIC AS revenue
    FROM month_orders
    GROUP BY week_num
  ),
  prev_weekly AS (
    SELECT week_num, COALESCE(SUM(total), 0)::NUMERIC AS revenue
    FROM prev_orders
    GROUP BY week_num
  ),
  weeks AS (
    SELECT generate_series(1, 4) AS week_num
  ),
  -- Top 5 products by revenue this month
  top_products AS (
    SELECT
      p.name,
      COALESCE(SUM(oi.price * oi.quantity - oi.discount_amount), 0)::NUMERIC AS revenue
    FROM public.order_items oi
    JOIN public.orders o  ON o.id  = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.organization_id = p_organization_id
      AND o.status::text    = ANY(v_completed)
      AND o.created_at     >= p_month_start
    GROUP BY p.id, p.name
    ORDER BY revenue DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'weekly', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'week',    w.week_num,
          'current', COALESCE(mw.revenue, 0),
          'prev',    COALESCE(pw.revenue, 0)
        ) ORDER BY w.week_num
      )
      FROM weeks w
      LEFT JOIN month_weekly mw ON mw.week_num = w.week_num
      LEFT JOIN prev_weekly  pw ON pw.week_num = w.week_num
    ),
    'top_products', (
      SELECT jsonb_agg(jsonb_build_object('name', tp.name, 'revenue', tp.revenue))
      FROM top_products tp
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;
