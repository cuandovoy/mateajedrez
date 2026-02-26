-- Ajuste financiero: el flujo de dinero debe considerar solo cobros reales (order_payments),
-- no ventas a crédito sin cobro. El stock ya se impacta por order_items.

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

  WITH params AS (
    SELECT
      (p_range_start AT TIME ZONE v_tz)::DATE AS day_start,
      (p_range_end AT TIME ZONE v_tz)::DATE AS day_end
  ),
  sales_summary AS (
    SELECT
      COALESCE(SUM(msd.sales_amount), 0)::NUMERIC AS revenue,
      COALESCE(SUM(msd.orders_count), 0)::BIGINT AS orders
    FROM public.mv_fin_sales_daily msd
    CROSS JOIN params p
    WHERE msd.organization_id = p_organization_id
      AND msd.day >= p.day_start
      AND msd.day <= p.day_end
      AND (p_branch_id IS NULL OR msd.branch_id = p_branch_id)
  ),
  sales_accrual_summary AS (
    SELECT
      COALESCE(SUM(o.subtotal_before_discount), 0)::NUMERIC AS gross_sales,
      COALESCE(SUM(o.discount_total), 0)::NUMERIC AS discounts_granted,
      COALESCE(SUM(o.total), 0)::NUMERIC AS net_sales
    FROM public.orders o
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered')
      AND (o.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (o.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  collected_summary AS (
    SELECT
      COALESCE(SUM(op.amount), 0)::NUMERIC AS collected_income
    FROM public.order_payments op
    JOIN public.orders o ON o.id = op.order_id
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status <> 'cancelled'
      AND (op.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (op.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  sales_margin AS (
    SELECT
      COALESCE(SUM(mmd.gross_margin), 0)::NUMERIC AS gross_margin
    FROM public.mv_fin_margin_daily mmd
    CROSS JOIN params p
    WHERE mmd.organization_id = p_organization_id
      AND mmd.day >= p.day_start
      AND mmd.day <= p.day_end
      AND (p_branch_id IS NULL OR mmd.branch_id = p_branch_id)
  ),
  expense_summary AS (
    SELECT
      COALESCE(SUM(med.accrual_expense), 0)::NUMERIC AS accrual_expense,
      COALESCE(SUM(med.cash_expense), 0)::NUMERIC AS cash_expense
    FROM public.mv_fin_expenses_daily med
    CROSS JOIN params p
    WHERE med.organization_id = p_organization_id
      AND med.day >= p.day_start
      AND med.day <= p.day_end
      AND (p_branch_id IS NULL OR med.branch_id = p_branch_id)
  ),
  daily_bucket AS (
    SELECT gs::DATE AS day
    FROM generate_series(
      (p_range_start AT TIME ZONE v_tz)::DATE,
      (p_range_end AT TIME ZONE v_tz)::DATE,
      INTERVAL '1 day'
    ) gs
  ),
  daily_collections AS (
    SELECT
      (op.created_at AT TIME ZONE v_tz)::DATE AS day,
      COALESCE(SUM(op.amount), 0)::NUMERIC AS collected_amount
    FROM public.order_payments op
    JOIN public.orders o ON o.id = op.order_id
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status <> 'cancelled'
      AND (op.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (op.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
    GROUP BY 1
  ),
  daily_expenses AS (
    SELECT
      med.day,
      COALESCE(SUM(med.expense_amount), 0)::NUMERIC AS expense_amount
    FROM public.mv_fin_expenses_daily med
    CROSS JOIN params p
    WHERE med.organization_id = p_organization_id
      AND med.day >= p.day_start
      AND med.day <= p.day_end
      AND (p_branch_id IS NULL OR med.branch_id = p_branch_id)
    GROUP BY med.day
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
  monthly_collections AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', op.created_at AT TIME ZONE v_tz), 'YYYY-MM') AS month_key,
      COALESCE(SUM(op.amount), 0)::NUMERIC AS collected_amount
    FROM public.order_payments op
    JOIN public.orders o ON o.id = op.order_id
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status <> 'cancelled'
      AND (op.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (op.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
    GROUP BY 1
  ),
  monthly_expenses AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', med.day::timestamp), 'YYYY-MM') AS month_key,
      COALESCE(SUM(med.expense_amount), 0)::NUMERIC AS expense_amount
    FROM public.mv_fin_expenses_daily med
    CROSS JOIN params p
    WHERE med.organization_id = p_organization_id
      AND med.day >= p.day_start
      AND med.day <= p.day_end
      AND (p_branch_id IS NULL OR med.branch_id = p_branch_id)
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
      'gross_sales', sas.gross_sales,
      'discounts_granted', sas.discounts_granted,
      'net_sales', sas.net_sales,
      'collected_income', cs.collected_income,
      'sales_orders', ss.orders,
      'gross_margin', sm.gross_margin,
      'accrual_expense', es.accrual_expense,
      'cash_expense', es.cash_expense,
      'net_cashflow', cs.collected_income - es.cash_expense
    ),
    'daily_sales_vs_expenses', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'date', TO_CHAR(db.day, 'YYYY-MM-DD'),
            'sales', COALESCE(dc.collected_amount, 0),
            'expenses', COALESCE(de.expense_amount, 0),
            'net', COALESCE(dc.collected_amount, 0) - COALESCE(de.expense_amount, 0)
          )
          ORDER BY db.day
        ),
        '[]'::JSONB
      )
      FROM daily_bucket db
      LEFT JOIN daily_collections dc ON dc.day = db.day
      LEFT JOIN daily_expenses de ON de.day = db.day
    ),
    'monthly_sales_vs_expenses', (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'month', mb.month_key,
            'sales', COALESCE(mc.collected_amount, 0),
            'expenses', COALESCE(me.expense_amount, 0),
            'net', COALESCE(mc.collected_amount, 0) - COALESCE(me.expense_amount, 0)
          )
          ORDER BY mb.month_date
        ),
        '[]'::JSONB
      )
      FROM monthly_bucket mb
      LEFT JOIN monthly_collections mc ON mc.month_key = mb.month_key
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
  CROSS JOIN sales_accrual_summary sas
  CROSS JOIN collected_summary cs
  CROSS JOIN sales_margin sm
  CROSS JOIN expense_summary es
  CROSS JOIN ap_aging aa;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION public.get_financial_report_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, DATE)
IS 'Resumen financiero con métricas de ventas brutas, descuentos otorgados, ventas netas y flujo de caja por cobros reales.';


CREATE OR REPLACE FUNCTION public.export_financial_report_rows(
  p_organization_id UUID,
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ,
  p_branch_id UUID DEFAULT NULL,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 5000,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  section TEXT,
  row_key TEXT,
  metric_label TEXT,
  value_1 NUMERIC,
  value_2 NUMERIC,
  value_3 NUMERIC,
  extra JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  IF COALESCE(p_limit, 0) <= 0 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'p_limit inválido (1..10000)';
  END IF;

  IF COALESCE(p_offset, 0) < 0 THEN
    RAISE EXCEPTION 'p_offset inválido';
  END IF;

  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  RETURN QUERY
  WITH params AS (
    SELECT
      (p_range_start AT TIME ZONE v_tz)::DATE AS day_start,
      (p_range_end AT TIME ZONE v_tz)::DATE AS day_end
  ),
  sales_summary AS (
    SELECT
      COALESCE(SUM(msd.sales_amount), 0)::NUMERIC AS revenue,
      COALESCE(SUM(msd.orders_count), 0)::NUMERIC AS orders
    FROM public.mv_fin_sales_daily msd
    CROSS JOIN params p
    WHERE msd.organization_id = p_organization_id
      AND msd.day >= p.day_start
      AND msd.day <= p.day_end
      AND (p_branch_id IS NULL OR msd.branch_id = p_branch_id)
  ),
  sales_accrual_summary AS (
    SELECT
      COALESCE(SUM(o.subtotal_before_discount), 0)::NUMERIC AS gross_sales,
      COALESCE(SUM(o.discount_total), 0)::NUMERIC AS discounts_granted,
      COALESCE(SUM(o.total), 0)::NUMERIC AS net_sales
    FROM public.orders o
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'processing', 'shipped', 'delivered')
      AND (o.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (o.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  collections_summary AS (
    SELECT
      COALESCE(SUM(op.amount), 0)::NUMERIC AS collected_income
    FROM public.order_payments op
    JOIN public.orders o ON o.id = op.order_id
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status <> 'cancelled'
      AND (op.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (op.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  ),
  sales_margin AS (
    SELECT COALESCE(SUM(mmd.gross_margin), 0)::NUMERIC AS gross_margin
    FROM public.mv_fin_margin_daily mmd
    CROSS JOIN params p
    WHERE mmd.organization_id = p_organization_id
      AND mmd.day >= p.day_start
      AND mmd.day <= p.day_end
      AND (p_branch_id IS NULL OR mmd.branch_id = p_branch_id)
  ),
  expense_summary AS (
    SELECT
      COALESCE(SUM(med.accrual_expense), 0)::NUMERIC AS accrual_expense,
      COALESCE(SUM(med.cash_expense), 0)::NUMERIC AS cash_expense
    FROM public.mv_fin_expenses_daily med
    CROSS JOIN params p
    WHERE med.organization_id = p_organization_id
      AND med.day >= p.day_start
      AND med.day <= p.day_end
      AND (p_branch_id IS NULL OR med.branch_id = p_branch_id)
  ),
  daily_bucket AS (
    SELECT gs::DATE AS day
    FROM generate_series(
      (p_range_start AT TIME ZONE v_tz)::DATE,
      (p_range_end AT TIME ZONE v_tz)::DATE,
      INTERVAL '1 day'
    ) gs
  ),
  daily_collections AS (
    SELECT
      (op.created_at AT TIME ZONE v_tz)::DATE AS day,
      COALESCE(SUM(op.amount), 0)::NUMERIC AS collected_amount
    FROM public.order_payments op
    JOIN public.orders o ON o.id = op.order_id
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status <> 'cancelled'
      AND (op.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (op.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
    GROUP BY 1
  ),
  daily_expenses AS (
    SELECT
      med.day,
      COALESCE(SUM(med.expense_amount), 0)::NUMERIC AS expense_amount
    FROM public.mv_fin_expenses_daily med
    CROSS JOIN params p
    WHERE med.organization_id = p_organization_id
      AND med.day >= p.day_start
      AND med.day <= p.day_end
      AND (p_branch_id IS NULL OR med.branch_id = p_branch_id)
    GROUP BY med.day
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
  monthly_collections AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', op.created_at AT TIME ZONE v_tz), 'YYYY-MM') AS month_key,
      COALESCE(SUM(op.amount), 0)::NUMERIC AS collected_amount
    FROM public.order_payments op
    JOIN public.orders o ON o.id = op.order_id
    CROSS JOIN params p
    WHERE o.organization_id = p_organization_id
      AND o.status <> 'cancelled'
      AND (op.created_at AT TIME ZONE v_tz)::DATE >= p.day_start
      AND (op.created_at AT TIME ZONE v_tz)::DATE <= p.day_end
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
    GROUP BY 1
  ),
  monthly_expenses AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', med.day::timestamp), 'YYYY-MM') AS month_key,
      COALESCE(SUM(med.expense_amount), 0)::NUMERIC AS expense_amount
    FROM public.mv_fin_expenses_daily med
    CROSS JOIN params p
    WHERE med.organization_id = p_organization_id
      AND med.day >= p.day_start
      AND med.day <= p.day_end
      AND (p_branch_id IS NULL OR med.branch_id = p_branch_id)
    GROUP BY 1
  ),
  ap_open AS (
    SELECT
      si.id,
      si.invoice_number,
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
      COALESCE(COUNT(*), 0)::NUMERIC AS open_invoices
    FROM ap_open
  ),
  top_suppliers AS (
    SELECT
      ao.supplier_id,
      COALESCE(s.name, 'Proveedor')::TEXT AS supplier_name,
      COALESCE(SUM(ao.outstanding_amount), 0)::NUMERIC AS outstanding_amount
    FROM ap_open ao
    LEFT JOIN public.suppliers s ON s.id = ao.supplier_id
    GROUP BY ao.supplier_id, s.name
    ORDER BY outstanding_amount DESC
    LIMIT 100
  ),
  dataset AS (
    SELECT
      'summary'::TEXT AS section,
      'resumen_general'::TEXT AS row_key,
      'Resumen general'::TEXT AS metric_label,
      cs.collected_income AS value_1,
      es.cash_expense AS value_2,
      (cs.collected_income - es.cash_expense) AS value_3,
      jsonb_build_object(
        'sales_orders', ss.orders,
        'sales_revenue', ss.revenue,
        'gross_sales', sas.gross_sales,
        'discounts_granted', sas.discounts_granted,
        'net_sales', sas.net_sales,
        'gross_margin', sm.gross_margin,
        'accrual_expense', es.accrual_expense,
        'as_of_date', p_as_of_date
      ) AS extra
    FROM sales_summary ss
    CROSS JOIN sales_accrual_summary sas
    CROSS JOIN collections_summary cs
    CROSS JOIN sales_margin sm
    CROSS JOIN expense_summary es

    UNION ALL

    SELECT
      'daily_sales_vs_expenses'::TEXT,
      TO_CHAR(db.day, 'YYYY-MM-DD'),
      'Día'::TEXT,
      COALESCE(dc.collected_amount, 0)::NUMERIC,
      COALESCE(de.expense_amount, 0)::NUMERIC,
      COALESCE(dc.collected_amount, 0)::NUMERIC - COALESCE(de.expense_amount, 0)::NUMERIC,
      jsonb_build_object('date', TO_CHAR(db.day, 'YYYY-MM-DD'))
    FROM daily_bucket db
    LEFT JOIN daily_collections dc ON dc.day = db.day
    LEFT JOIN daily_expenses de ON de.day = db.day

    UNION ALL

    SELECT
      'monthly_sales_vs_expenses'::TEXT,
      mb.month_key,
      'Mes'::TEXT,
      COALESCE(mc.collected_amount, 0)::NUMERIC,
      COALESCE(me.expense_amount, 0)::NUMERIC,
      COALESCE(mc.collected_amount, 0)::NUMERIC - COALESCE(me.expense_amount, 0)::NUMERIC,
      jsonb_build_object('month', mb.month_key)
    FROM monthly_bucket mb
    LEFT JOIN monthly_collections mc ON mc.month_key = mb.month_key
    LEFT JOIN monthly_expenses me ON me.month_key = mb.month_key

    UNION ALL

    SELECT
      'accounts_payable_aging'::TEXT,
      bucket.row_key,
      bucket.metric_label,
      bucket.value_1,
      NULL::NUMERIC,
      NULL::NUMERIC,
      jsonb_build_object('as_of_date', p_as_of_date, 'open_invoices', aa.open_invoices)
    FROM ap_aging aa
    CROSS JOIN LATERAL (
      VALUES
        ('current', 'Corriente', aa.current_bucket),
        ('days_1_30', '1-30 días', aa.bucket_1_30),
        ('days_31_60', '31-60 días', aa.bucket_31_60),
        ('days_61_90', '61-90 días', aa.bucket_61_90),
        ('days_90_plus', '+90 días', aa.bucket_90_plus),
        ('total_outstanding', 'Total pendiente', aa.total_outstanding)
    ) AS bucket(row_key, metric_label, value_1)

    UNION ALL

    SELECT
      'top_suppliers_outstanding'::TEXT,
      COALESCE(ts.supplier_id::TEXT, 'no-supplier') AS row_key,
      ts.supplier_name,
      ts.outstanding_amount,
      NULL::NUMERIC,
      NULL::NUMERIC,
      jsonb_build_object('supplier_id', ts.supplier_id)
    FROM top_suppliers ts

    UNION ALL

    SELECT
      'accounts_payable_open'::TEXT,
      ao.id::TEXT AS row_key,
      COALESCE(s.name, 'Proveedor')::TEXT AS metric_label,
      ao.outstanding_amount AS value_1,
      ao.days_overdue::NUMERIC AS value_2,
      NULL::NUMERIC AS value_3,
      jsonb_build_object(
        'invoice_id', ao.id,
        'invoice_number', ao.invoice_number,
        'supplier_id', ao.supplier_id,
        'due_date', ao.due_date,
        'days_overdue', ao.days_overdue
      )
    FROM ap_open ao
    LEFT JOIN public.suppliers s ON s.id = ao.supplier_id
  )
  SELECT
    d.section,
    d.row_key,
    d.metric_label,
    d.value_1,
    d.value_2,
    d.value_3,
    d.extra
  FROM dataset d
  ORDER BY d.section, d.row_key
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.export_financial_report_rows(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, DATE, INTEGER, INTEGER)
IS 'Exportación paginada con cobros reales y metadata ampliada de ventas brutas, descuentos y ventas netas.';
