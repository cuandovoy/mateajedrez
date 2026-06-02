-- Migration: RPC para el reporte de reposición de stock
-- Devuelve todos los productos que están por debajo de su umbral de stock,
-- con métricas de rotación y proveedor primario.

CREATE OR REPLACE FUNCTION get_reposicion_report(p_organization_id UUID)
RETURNS TABLE (
  product_id          UUID,
  product_name        TEXT,
  sku                 TEXT,
  branch_id           UUID,
  branch_name         TEXT,
  stock_actual        INTEGER,
  low_stock_threshold INTEGER,
  min_stock           INTEGER,
  ventas_30d          NUMERIC,
  dias_stock          NUMERIC,
  supplier_id         UUID,
  supplier_name       TEXT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id                                                    AS product_id,
    p.name                                                  AS product_name,
    p.sku                                                   AS sku,
    b.id                                                    AS branch_id,
    b.name                                                  AS branch_name,
    bi.stock                                                AS stock_actual,
    COALESCE(bi.low_stock_threshold, 5)                     AS low_stock_threshold,
    COALESCE(bi.min_stock, 0)                               AS min_stock,
    COALESCE(v.ventas_30d, 0)                               AS ventas_30d,
    CASE
      WHEN COALESCE(v.ventas_30d, 0) = 0 THEN NULL
      ELSE ROUND(bi.stock / (v.ventas_30d / 30.0), 1)
    END                                                     AS dias_stock,
    ps.supplier_id                                          AS supplier_id,
    s.name                                                  AS supplier_name
  FROM branch_inventory bi
  JOIN branches b
    ON b.id = bi.branch_id
   AND b.organization_id = p_organization_id
   AND b.is_active = true
  JOIN products p
    ON p.id = bi.product_id
   AND p.organization_id = p_organization_id
   AND p.is_active = true
  LEFT JOIN (
    SELECT oi.product_id, SUM(oi.quantity) AS ventas_30d
    FROM order_items oi
    JOIN orders o
      ON o.id = oi.order_id
     AND o.organization_id = p_organization_id
     AND o.created_at >= NOW() - INTERVAL '30 days'
     AND o.status NOT IN ('cancelled')
    GROUP BY oi.product_id
  ) v ON v.product_id = p.id
  LEFT JOIN product_suppliers ps
    ON ps.product_id = p.id
   AND ps.is_primary = true
  LEFT JOIN suppliers s ON s.id = ps.supplier_id
  WHERE bi.variant_id IS NULL
    AND bi.stock <= GREATEST(COALESCE(bi.low_stock_threshold, 5), COALESCE(bi.min_stock, 0))
  ORDER BY dias_stock ASC NULLS LAST, bi.stock ASC, p.name ASC;
$$;

GRANT EXECUTE ON FUNCTION get_reposicion_report(UUID) TO authenticated;

COMMENT ON FUNCTION get_reposicion_report IS
  'Devuelve productos bajo umbral de stock con días de rotación y proveedor primario. '
  'Usado por la pantalla /reposicion para generar órdenes de compra.';
