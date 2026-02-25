-- Phase 4 (part 1): financial report summary RPC
-- Includes:
-- - Sales vs expenses (daily/monthly)
-- - Cashflow summary
-- - Accounts payable aging

CREATE OR REPLACE FUNCTION public.get_financial_report_summary(
  p_organization_id UUID,
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE
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

  IF p_range_start IS NULL OR p_range_end IS NULL THEN
    RAISE EXCEPTION 'Rango de fechas incompleto';
  END IF;

  IF p_range_start > p_range_end THEN
    RAISE EXCEPTION 'Rango inválido';
  END IF;

  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  WITH sales_orders AS (
    SELECT o.id, o.total, o.created_at
    FROM public.orders o
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered')
      AND o.created_at >= p_range_start
      AND o.created_at <= p_range_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  sales_summary AS (
    SELECT
      COALESCE(SUM(so.total), 0)::NUMERIC AS revenue,
      COALESCE(COUNT(*), 0)::BIGINT AS orders
    FROM sales_orders so
  ),
  sales_margin AS (
    SELECT
      COALESCE(SUM(oi.margin_at_sale) FILTER (WHERE oi.margin_at_sale IS NOT NULL), 0)::NUMERIC AS gross_margin
    FROM public.order_items oi
    INNER JOIN sales_orders so ON so.id = oi.order_id
  ),
  expense_summary AS (
    SELECT
      COALESCE(SUM(el.net_amount) FILTER (WHERE el.entry_kind = 'accrual'), 0)::NUMERIC AS accrual_expense,
      COALESCE(SUM(el.net_amount) FILTER (WHERE el.entry_kind = 'cash'), 0)::NUMERIC AS cash_expense
    FROM public.expense_ledger el
    WHERE el.organization_id = p_organization_id
      AND el.status = 'posted'
      AND el.occurred_at >= p_range_start
      AND el.occurred_at <= p_range_end
      AND (p_branch_id IS NULL OR el.branch_id = p_branch_id)
  ),
  daily_bucket AS (
    SELECT gs::DATE AS day
    FROM generate_series(
      (p_range_start AT TIME ZONE v_tz)::DATE,
      (p_range_end AT TIME ZONE v_tz)::DATE,
      INTERVAL '1 day'
    ) gs
  ),
  daily_sales AS (
    SELECT
      (so.created_at AT TIME ZONE v_tz)::DATE AS day,
      COALESCE(SUM(so.total), 0)::NUMERIC AS sales_amount
    FROM sales_orders so
    GROUP BY 1
  ),
  daily_expenses AS (
    SELECT
      (el.occurred_at AT TIME ZONE v_tz)::DATE AS day,
      COALESCE(SUM(el.net_amount), 0)::NUMERIC AS expense_amount
    FROM public.expense_ledger el
    WHERE el.organization_id = p_organization_id
      AND el.status = 'posted'
      AND el.occurred_at >= p_range_start
      AND el.occurred_at <= p_range_end
      AND (p_branch_id IS NULL OR el.branch_id = p_branch_id)
    GROUP BY 1
  ),
  monthly_bucket AS (
    SELECT
      TO_CHAR(gs, 'YYYY-MM') AS month_key,
      gs::DATE AS month_date
    FROM generate_series(
      DATE_TRUNC('month', p_range_start AT TIME ZONE v_tz)::DATE,
      DATE_TRUNC('month', p_range_end AT TIME ZONE v_tz)::DATE,
      INTERVAL '1 month'
    ) gs
  ),
  monthly_sales AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', so.created_at AT TIME ZONE v_tz), 'YYYY-MM') AS month_key,
      COALESCE(SUM(so.total), 0)::NUMERIC AS sales_amount
    FROM sales_orders so
    GROUP BY 1
  ),
  monthly_expenses AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', el.occurred_at AT TIME ZONE v_tz), 'YYYY-MM') AS month_key,
      COALESCE(SUM(el.net_amount), 0)::NUMERIC AS expense_amount
    FROM public.expense_ledger el
    WHERE el.organization_id = p_organization_id
      AND el.status = 'posted'
      AND el.occurred_at >= p_range_start
      AND el.occurred_at <= p_range_end
      AND (p_branch_id IS NULL OR el.branch_id = p_branch_id)
    GROUP BY 1
  ),
  ap_open AS (
    SELECT
      si.id,
      si.supplier_id,
      si.due_date,
      COALESCE(si.outstanding_amount, 0)::NUMERIC AS outstanding_amount,
      CASE
        WHEN si.due_date IS NULL THEN 0
        ELSE GREATEST((p_as_of_date - si.due_date), 0)
      END::INTEGER AS days_overdue
    FROM public.supplier_invoices si
    WHERE si.organization_id = p_organization_id
      AND si.status IN ('issued', 'partially_paid', 'paid')
      AND COALESCE(si.outstanding_amount, 0) > 0
      AND (p_branch_id IS NULL OR si.branch_id = p_branch_id)
  ),
  ap_aging AS (
    SELECT
      COALESCE(SUM(outstanding_amount) FILTER (WHERE days_overdue = 0), 0)::NUMERIC AS current_bucket,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE days_overdue BETWEEN 1 AND 30), 0)::NUMERIC AS bucket_1_30,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE days_overdue BETWEEN 31 AND 60), 0)::NUMERIC AS bucket_31_60,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE days_overdue BETWEEN 61 AND 90), 0)::NUMERIC AS bucket_61_90,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE days_overdue > 90), 0)::NUMERIC AS bucket_90_plus,
      COALESCE(SUM(outstanding_amount), 0)::NUMERIC AS total_outstanding,
      COALESCE(COUNT(*), 0)::BIGINT AS open_invoices
    FROM ap_open
  ),
  ap_suppliers AS (
    SELECT
      ao.supplier_id,
      COALESCE(s.name, 'Proveedor')::TEXT AS supplier_name,
      COALESCE(SUM(ao.outstanding_amount), 0)::NUMERIC AS outstanding_amount
    FROM ap_open ao
    LEFT JOIN public.suppliers s ON s.id = ao.supplier_id
    GROUP BY ao.supplier_id, s.name
    ORDER BY outstanding_amount DESC
    LIMIT 10
  )
  SELECT JSONB_BUILD_OBJECT(
    'summary', JSONB_BUILD_OBJECT(
      'sales_revenue', ss.revenue,
      'sales_orders', ss.orders,
      'gross_margin', sm.gross_margin,
      'accrual_expense', es.accrual_expense,
      'cash_expense', es.cash_expense,
      'net_cashflow', ss.revenue - es.cash_expense
    ),
    'daily_sales_vs_expenses', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'date', TO_CHAR(db.day, 'YYYY-MM-DD'),
            'sales', COALESCE(ds.sales_amount, 0),
            'expenses', COALESCE(de.expense_amount, 0),
            'net', COALESCE(ds.sales_amount, 0) - COALESCE(de.expense_amount, 0)
          )
          ORDER BY db.day
        ),
        '[]'::JSONB
      )
      FROM daily_bucket db
      LEFT JOIN daily_sales ds ON ds.day = db.day
      LEFT JOIN daily_expenses de ON de.day = db.day
    ),
    'monthly_sales_vs_expenses', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'month', mb.month_key,
            'sales', COALESCE(ms.sales_amount, 0),
            'expenses', COALESCE(me.expense_amount, 0),
            'net', COALESCE(ms.sales_amount, 0) - COALESCE(me.expense_amount, 0)
          )
          ORDER BY mb.month_date
        ),
        '[]'::JSONB
      )
      FROM monthly_bucket mb
      LEFT JOIN monthly_sales ms ON ms.month_key = mb.month_key
      LEFT JOIN monthly_expenses me ON me.month_key = mb.month_key
    ),
    'accounts_payable_aging', JSONB_BUILD_OBJECT(
      'current', aa.current_bucket,
      'days_1_30', aa.bucket_1_30,
      'days_31_60', aa.bucket_31_60,
      'days_61_90', aa.bucket_61_90,
      'days_90_plus', aa.bucket_90_plus,
      'total_outstanding', aa.total_outstanding,
      'open_invoices', aa.open_invoices
    ),
    'top_suppliers_outstanding', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'supplier_id', aps.supplier_id,
            'supplier_name', aps.supplier_name,
            'outstanding_amount', aps.outstanding_amount
          )
          ORDER BY aps.outstanding_amount DESC
        ),
        '[]'::JSONB
      )
      FROM ap_suppliers aps
    )
  )
  INTO v_result
  FROM sales_summary ss
  CROSS JOIN sales_margin sm
  CROSS JOIN expense_summary es
  CROSS JOIN ap_aging aa;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_report_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, DATE)
TO authenticated;

COMMENT ON FUNCTION public.get_financial_report_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, DATE)
IS 'Resumen financiero: ventas vs egresos (diario/mensual), flujo neto y aging de cuentas por pagar.';
