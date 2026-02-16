-- RPC para poblar entradas de inventario faltantes (multi-tenant)
-- Para bases existentes que no tienen esta función.
-- Si usaste 000_full_schema_fresh_install.sql reciente, ya la incluye.

DROP FUNCTION IF EXISTS public.populate_missing_inventory_entries_rpc() CASCADE;

CREATE OR REPLACE FUNCTION public.populate_missing_inventory_entries_rpc()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_variants_count INTEGER := 0;
BEGIN
  -- Productos sin variantes: crear inventario por branch de la misma org
  INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
  SELECT b.id, p.id, NULL, 0, COALESCE(p.min_stock, 0), COALESCE(p.low_stock_threshold, 10)
  FROM branches b
  JOIN products p ON b.organization_id = p.organization_id
  WHERE b.is_active = true AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory
    WHERE branch_id = b.id AND product_id = p.id AND variant_id IS NULL
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Variantes: crear inventario por branch de la misma org (vía product)
  INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
  SELECT b.id, NULL, pv.id, 0,
    COALESCE(pv.min_stock, p.min_stock, 0),
    COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 10)
  FROM branches b
  JOIN products p ON p.organization_id = b.organization_id
  JOIN product_variants pv ON pv.product_id = p.id
  WHERE b.is_active = true AND p.is_active = true AND pv.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory
    WHERE branch_id = b.id AND variant_id = pv.id AND product_id IS NULL
  );
  GET DIAGNOSTICS v_variants_count = ROW_COUNT;

  v_count := v_count + v_variants_count;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc() TO authenticated;
COMMENT ON FUNCTION public.populate_missing_inventory_entries_rpc() IS 'Crea entradas de inventario faltantes. Multi-tenant: solo branches y products de la misma org.';
