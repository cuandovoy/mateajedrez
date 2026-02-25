-- Phase 4 (part 3): backend export rows for large financial reports
-- Provides a paginated, filterable dataset for CSV/Excel generation in frontend or jobs.

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
      ss.revenue AS value_1,
      es.cash_expense AS value_2,
      (ss.revenue - es.cash_expense) AS value_3,
      jsonb_build_object(
        'sales_orders', ss.orders,
        'gross_margin', sm.gross_margin,
        'accrual_expense', es.accrual_expense,
        'as_of_date', p_as_of_date
      ) AS extra
    FROM sales_summary ss
    CROSS JOIN sales_margin sm
    CROSS JOIN expense_summary es

    UNION ALL

    SELECT
      'daily_sales_vs_expenses'::TEXT,
      TO_CHAR(msd.day, 'YYYY-MM-DD'),
      'Día'::TEXT,
      COALESCE(SUM(msd.sales_amount), 0)::NUMERIC,
      COALESCE(SUM(med.expense_amount), 0)::NUMERIC,
      COALESCE(SUM(msd.sales_amount), 0)::NUMERIC - COALESCE(SUM(med.expense_amount), 0)::NUMERIC,
      jsonb_build_object('date', TO_CHAR(msd.day, 'YYYY-MM-DD'))
    FROM public.mv_fin_sales_daily msd
    LEFT JOIN public.mv_fin_expenses_daily med
      ON med.organization_id = msd.organization_id
      AND (med.branch_id IS NOT DISTINCT FROM msd.branch_id)
      AND med.day = msd.day
    CROSS JOIN params p
    WHERE msd.organization_id = p_organization_id
      AND msd.day >= p.day_start
      AND msd.day <= p.day_end
      AND (p_branch_id IS NULL OR msd.branch_id = p_branch_id)
    GROUP BY msd.day

    UNION ALL

    SELECT
      'monthly_sales_vs_expenses'::TEXT,
      TO_CHAR(DATE_TRUNC('month', msd.day::timestamp), 'YYYY-MM'),
      'Mes'::TEXT,
      COALESCE(SUM(msd.sales_amount), 0)::NUMERIC,
      COALESCE(SUM(med.expense_amount), 0)::NUMERIC,
      COALESCE(SUM(msd.sales_amount), 0)::NUMERIC - COALESCE(SUM(med.expense_amount), 0)::NUMERIC,
      jsonb_build_object('month', TO_CHAR(DATE_TRUNC('month', msd.day::timestamp), 'YYYY-MM'))
    FROM public.mv_fin_sales_daily msd
    LEFT JOIN public.mv_fin_expenses_daily med
      ON med.organization_id = msd.organization_id
      AND (med.branch_id IS NOT DISTINCT FROM msd.branch_id)
      AND med.day = msd.day
    CROSS JOIN params p
    WHERE msd.organization_id = p_organization_id
      AND msd.day >= p.day_start
      AND msd.day <= p.day_end
      AND (p_branch_id IS NULL OR msd.branch_id = p_branch_id)
    GROUP BY 2

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

GRANT EXECUTE ON FUNCTION public.export_financial_report_rows(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, DATE, INTEGER, INTEGER)
TO authenticated;

COMMENT ON FUNCTION public.export_financial_report_rows(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, DATE, INTEGER, INTEGER)
IS 'Exportación backend paginada para reportes financieros grandes (summary, diario, mensual, aging, proveedores y facturas abiertas).';
