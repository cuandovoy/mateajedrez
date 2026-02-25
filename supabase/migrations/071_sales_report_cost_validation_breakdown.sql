-- Phase 3 (part 3): validation breakdown for missing cost snapshots in sales reports

CREATE OR REPLACE FUNCTION public.get_sales_report_summary(
  p_organization_id UUID,
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ,
  p_compare_start TIMESTAMPTZ,
  p_compare_end TIMESTAMPTZ,
  p_monthly_start TIMESTAMPTZ,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_tz TEXT := 'America/Montevideo';
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id es requerido';
  END IF;

  IF p_range_start IS NULL OR p_range_end IS NULL OR p_compare_start IS NULL OR p_compare_end IS NULL OR p_monthly_start IS NULL THEN
    RAISE EXCEPTION 'Rangos de fecha incompletos';
  END IF;

  IF p_range_start > p_range_end THEN
    RAISE EXCEPTION 'Rango actual inválido';
  END IF;

  IF p_compare_start > p_compare_end THEN
    RAISE EXCEPTION 'Rango comparativo inválido';
  END IF;

  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  WITH current_orders AS (
    SELECT o.id, o.total, o.payment_method, o.created_at, o.branch_id
    FROM public.orders o
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered')
      AND o.created_at >= p_range_start
      AND o.created_at <= p_range_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  previous_orders AS (
    SELECT o.id, o.total
    FROM public.orders o
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered')
      AND o.created_at >= p_compare_start
      AND o.created_at <= p_compare_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  monthly_orders AS (
    SELECT o.total, o.created_at
    FROM public.orders o
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered')
      AND o.created_at >= p_monthly_start
      AND o.created_at <= p_range_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  current_order_items AS (
    SELECT oi.*
    FROM public.order_items oi
    INNER JOIN current_orders co ON co.id = oi.order_id
  ),
  previous_order_items AS (
    SELECT oi.*
    FROM public.order_items oi
    INNER JOIN previous_orders po ON po.id = oi.order_id
  ),
  current_summary AS (
    SELECT
      COUNT(*)::BIGINT AS orders,
      COALESCE(SUM(total), 0)::NUMERIC AS revenue,
      COALESCE(AVG(total), 0)::NUMERIC AS avg_ticket
    FROM current_orders
  ),
  previous_summary AS (
    SELECT
      COUNT(*)::BIGINT AS orders,
      COALESCE(SUM(total), 0)::NUMERIC AS revenue
    FROM previous_orders
  ),
  current_margin AS (
    SELECT
      COALESCE(SUM(oi.margin_at_sale) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::NUMERIC AS gross_margin,
      COALESCE(SUM((oi.cost_at_sale * oi.quantity)::NUMERIC) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::NUMERIC AS tracked_cost,
      COALESCE(SUM((oi.price * oi.quantity)::NUMERIC) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::NUMERIC AS tracked_revenue,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::BIGINT AS tracked_items,
      COALESCE(COUNT(*), 0)::BIGINT AS total_items,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NULL), 0)::BIGINT AS missing_items,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NULL AND oi.cost_source = 'branch_missing'), 0)::BIGINT AS branch_missing_items,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NULL AND oi.cost_source = 'inventory_cost_missing'), 0)::BIGINT AS inventory_cost_missing_items
    FROM current_order_items oi
  ),
  previous_margin AS (
    SELECT
      COALESCE(SUM(oi.margin_at_sale) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::NUMERIC AS gross_margin,
      COALESCE(SUM((oi.cost_at_sale * oi.quantity)::NUMERIC) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::NUMERIC AS tracked_cost,
      COALESCE(SUM((oi.price * oi.quantity)::NUMERIC) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::NUMERIC AS tracked_revenue,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NOT NULL), 0)::BIGINT AS tracked_items,
      COALESCE(COUNT(*), 0)::BIGINT AS total_items,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NULL), 0)::BIGINT AS missing_items,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NULL AND oi.cost_source = 'branch_missing'), 0)::BIGINT AS branch_missing_items,
      COALESCE(COUNT(*) FILTER (WHERE oi.cost_at_sale IS NULL AND oi.cost_source = 'inventory_cost_missing'), 0)::BIGINT AS inventory_cost_missing_items
    FROM previous_order_items oi
  ),
  daily_bucket AS (
    SELECT gs::DATE AS day
    FROM generate_series(
      (p_range_start AT TIME ZONE v_tz)::DATE,
      (p_range_end AT TIME ZONE v_tz)::DATE,
      INTERVAL '1 day'
    ) gs
  ),
  daily_agg AS (
    SELECT
      (o.created_at AT TIME ZONE v_tz)::DATE AS day,
      COUNT(*)::BIGINT AS orders,
      COALESCE(SUM(o.total), 0)::NUMERIC AS revenue
    FROM current_orders o
    GROUP BY 1
  ),
  monthly_bucket AS (
    SELECT
      TO_CHAR(gs, 'YYYY-MM') AS month_key,
      gs::DATE AS month_date
    FROM generate_series(
      DATE_TRUNC('month', p_monthly_start AT TIME ZONE v_tz)::DATE,
      DATE_TRUNC('month', p_range_end AT TIME ZONE v_tz)::DATE,
      INTERVAL '1 month'
    ) gs
  ),
  monthly_agg AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', o.created_at AT TIME ZONE v_tz), 'YYYY-MM') AS month_key,
      COUNT(*)::BIGINT AS orders,
      COALESCE(SUM(o.total), 0)::NUMERIC AS revenue
    FROM monthly_orders o
    GROUP BY 1
  ),
  payment_from_payments AS (
    SELECT
      op.payment_method,
      COALESCE(SUM(op.amount), 0)::NUMERIC AS amount
    FROM public.order_payments op
    INNER JOIN current_orders co ON co.id = op.order_id
    GROUP BY 1
  ),
  payment_fallback AS (
    SELECT
      co.payment_method,
      COALESCE(SUM(co.total), 0)::NUMERIC AS amount
    FROM current_orders co
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.order_payments op
      WHERE op.order_id = co.id
    )
    GROUP BY 1
  ),
  payment_union AS (
    SELECT payment_method, amount FROM payment_from_payments
    UNION ALL
    SELECT payment_method, amount FROM payment_fallback
  ),
  payment_totals AS (
    SELECT
      payment_method,
      COALESCE(SUM(amount), 0)::NUMERIC AS amount
    FROM payment_union
    GROUP BY 1
  ),
  branch_agg AS (
    SELECT
      COALESCE(co.branch_id::TEXT, 'no-branch') AS branch_id,
      COALESCE(b.name, 'Sin sucursal') AS branch_name,
      COUNT(*)::BIGINT AS orders,
      COALESCE(SUM(co.total), 0)::NUMERIC AS revenue
    FROM current_orders co
    LEFT JOIN public.branches b ON b.id = co.branch_id
    GROUP BY 1, 2
  )
  SELECT JSONB_BUILD_OBJECT(
    'current', JSONB_BUILD_OBJECT(
      'orders', cs.orders,
      'revenue', cs.revenue,
      'avg_ticket', cs.avg_ticket
    ),
    'previous', JSONB_BUILD_OBJECT(
      'orders', ps.orders,
      'revenue', ps.revenue
    ),
    'current_margin', JSONB_BUILD_OBJECT(
      'gross_margin', cm.gross_margin,
      'tracked_cost', cm.tracked_cost,
      'tracked_revenue', cm.tracked_revenue,
      'margin_pct', CASE
        WHEN cm.tracked_revenue > 0 THEN ROUND((cm.gross_margin / cm.tracked_revenue) * 100, 4)
        ELSE NULL
      END,
      'tracked_items', cm.tracked_items,
      'total_items', cm.total_items,
      'missing_items', cm.missing_items,
      'branch_missing_items', cm.branch_missing_items,
      'inventory_cost_missing_items', cm.inventory_cost_missing_items,
      'other_missing_items', GREATEST(cm.missing_items - cm.branch_missing_items - cm.inventory_cost_missing_items, 0)
    ),
    'previous_margin', JSONB_BUILD_OBJECT(
      'gross_margin', pm.gross_margin,
      'tracked_cost', pm.tracked_cost,
      'tracked_revenue', pm.tracked_revenue,
      'margin_pct', CASE
        WHEN pm.tracked_revenue > 0 THEN ROUND((pm.gross_margin / pm.tracked_revenue) * 100, 4)
        ELSE NULL
      END,
      'tracked_items', pm.tracked_items,
      'total_items', pm.total_items,
      'missing_items', pm.missing_items,
      'branch_missing_items', pm.branch_missing_items,
      'inventory_cost_missing_items', pm.inventory_cost_missing_items,
      'other_missing_items', GREATEST(pm.missing_items - pm.branch_missing_items - pm.inventory_cost_missing_items, 0)
    ),
    'daily', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'date', TO_CHAR(db.day, 'YYYY-MM-DD'),
            'orders', COALESCE(da.orders, 0),
            'revenue', COALESCE(da.revenue, 0)
          )
          ORDER BY db.day
        ),
        '[]'::JSONB
      )
      FROM daily_bucket db
      LEFT JOIN daily_agg da ON da.day = db.day
    ),
    'monthly', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'month', mb.month_key,
            'orders', COALESCE(ma.orders, 0),
            'revenue', COALESCE(ma.revenue, 0)
          )
          ORDER BY mb.month_date
        ),
        '[]'::JSONB
      )
      FROM monthly_bucket mb
      LEFT JOIN monthly_agg ma ON ma.month_key = mb.month_key
    ),
    'payment_methods', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'method', pt.payment_method,
            'amount', pt.amount
          )
          ORDER BY pt.amount DESC
        ),
        '[]'::JSONB
      )
      FROM payment_totals pt
    ),
    'branches', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'branch_id', ba.branch_id,
            'branch_name', ba.branch_name,
            'orders', ba.orders,
            'revenue', ba.revenue
          )
          ORDER BY ba.revenue DESC
        ),
        '[]'::JSONB
      )
      FROM branch_agg ba
    )
  )
  INTO v_result
  FROM current_summary cs
  CROSS JOIN previous_summary ps
  CROSS JOIN current_margin cm
  CROSS JOIN previous_margin pm;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION public.get_sales_report_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, UUID)
IS 'Reporte agregado de ventas con margen y desglose de cobertura de costo (branch_missing/inventory_cost_missing).';
