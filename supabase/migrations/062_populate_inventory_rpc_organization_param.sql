-- RPC para poblar inventario faltante: filtrar por organización actual
DROP FUNCTION IF EXISTS public.populate_missing_inventory_entries_rpc() CASCADE;

CREATE OR REPLACE FUNCTION public.populate_missing_inventory_entries_rpc(p_organization_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_variants_count INTEGER := 0;
  v_org_id UUID := p_organization_id;
BEGIN
  -- Si no se pasa organización, no crear entradas (evitar afectar todas las orgs)
  IF v_org_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Productos sin variantes: solo branches y products de la org indicada
  INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
  SELECT b.id, p.id, NULL, 0, COALESCE(p.min_stock, 0), COALESCE(p.low_stock_threshold, 10)
  FROM branches b
  JOIN products p ON b.organization_id = p.organization_id AND p.organization_id = v_org_id
  WHERE b.organization_id = v_org_id
    AND b.is_active = true
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM branch_inventory
      WHERE branch_id = b.id AND product_id = p.id AND variant_id IS NULL
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Variantes: solo branches y products de la org indicada
  INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
  SELECT b.id, NULL, pv.id, 0,
    COALESCE(pv.min_stock, p.min_stock, 0),
    COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 10)
  FROM branches b
  JOIN products p ON p.organization_id = b.organization_id AND p.organization_id = v_org_id
  JOIN product_variants pv ON pv.product_id = p.id
  WHERE b.organization_id = v_org_id
    AND b.is_active = true
    AND p.is_active = true
    AND pv.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM branch_inventory
      WHERE branch_id = b.id AND variant_id = pv.id AND product_id IS NULL
    );
  GET DIAGNOSTICS v_variants_count = ROW_COUNT;

  v_count := v_count + v_variants_count;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc(UUID) TO authenticated;
COMMENT ON FUNCTION public.populate_missing_inventory_entries_rpc(UUID) IS 'Crea entradas de inventario faltantes solo para la organización indicada (p_organization_id).';