-- Sincronización masiva de branch_inventory desde stocks maestros (products/product_variants).
-- Solo admin de la organización puede ejecutar.

CREATE OR REPLACE FUNCTION public.sync_inventory_from_master_stock(
  p_organization_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_only_desynced BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id es requerido';
  END IF;

  IF NOT public.is_org_admin(p_organization_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden sincronizar stock masivo.';
  END IF;

  WITH variant_source AS (
    SELECT
      bi.id AS branch_inventory_id,
      bi.stock AS previous_stock,
      pv.stock AS target_stock
    FROM public.branch_inventory bi
    JOIN public.branches b
      ON b.id = bi.branch_id
    JOIN public.product_variants pv
      ON pv.id = bi.variant_id
    JOIN public.products p
      ON p.id = pv.product_id
    WHERE b.organization_id = p_organization_id
      AND p.organization_id = p_organization_id
      AND bi.variant_id IS NOT NULL
      AND (p_branch_id IS NULL OR bi.branch_id = p_branch_id)
  ),
  product_source AS (
    SELECT
      bi.id AS branch_inventory_id,
      bi.stock AS previous_stock,
      p.stock AS target_stock
    FROM public.branch_inventory bi
    JOIN public.branches b
      ON b.id = bi.branch_id
    JOIN public.products p
      ON p.id = bi.product_id
    WHERE b.organization_id = p_organization_id
      AND p.organization_id = p_organization_id
      AND bi.variant_id IS NULL
      AND bi.product_id IS NOT NULL
      AND (p_branch_id IS NULL OR bi.branch_id = p_branch_id)
  ),
  source_rows AS (
    SELECT * FROM variant_source
    UNION ALL
    SELECT * FROM product_source
  ),
  rows_to_sync AS (
    SELECT
      s.branch_inventory_id,
      s.previous_stock,
      s.target_stock
    FROM source_rows s
    WHERE (NOT p_only_desynced)
       OR (s.previous_stock IS DISTINCT FROM s.target_stock)
  ),
  updated AS (
    UPDATE public.branch_inventory bi
    SET stock = r.target_stock,
        updated_at = NOW()
    FROM rows_to_sync r
    WHERE bi.id = r.branch_inventory_id
    RETURNING bi.id
  ),
  movement AS (
    INSERT INTO public.inventory_movements (
      branch_inventory_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reference_type,
      notes,
      created_by,
      created_at
    )
    SELECT
      r.branch_inventory_id,
      'adjustment',
      (r.target_stock - r.previous_stock),
      r.previous_stock,
      r.target_stock,
      'sync_stock_bulk',
      'Sincronización masiva desde stock maestro',
      auth.uid(),
      NOW()
    FROM rows_to_sync r
    WHERE r.previous_stock IS DISTINCT FROM r.target_stock
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER
  INTO v_updated_count
  FROM updated;

  RETURN COALESCE(v_updated_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_inventory_from_master_stock(UUID, UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.sync_inventory_from_master_stock(UUID, UUID, BOOLEAN)
IS 'Sincroniza stocks de branch_inventory desde products/product_variants por organización y opcionalmente sucursal.';
