-- Ajuste transaccional de stock de producto por sucursal.
-- branch_inventory es la fuente de verdad; products.stock se recalcula como agregado.

CREATE OR REPLACE FUNCTION public.update_product_stock_with_inventory(
  p_product_id UUID,
  p_branch_id UUID,
  p_new_stock INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_inventory_id UUID;
  v_previous_stock INTEGER := 0;
  v_total_stock INTEGER := 0;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id es requerido';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id es requerido';
  END IF;

  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'new_stock inválido';
  END IF;

  SELECT organization_id
  INTO v_org_id
  FROM public.products
  WHERE id = p_product_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece a la organización del producto';
  END IF;

  SELECT bi.id, bi.stock
  INTO v_inventory_id, v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_branch_id
    AND bi.product_id = p_product_id
    AND bi.variant_id IS NULL
  LIMIT 1;

  IF v_inventory_id IS NULL THEN
    INSERT INTO public.branch_inventory (
      branch_id,
      product_id,
      variant_id,
      stock,
      min_stock,
      low_stock_threshold
    )
    VALUES (
      p_branch_id,
      p_product_id,
      NULL,
      p_new_stock,
      0,
      10
    )
    RETURNING id, stock INTO v_inventory_id, v_previous_stock;

    v_previous_stock := 0;
  ELSE
    UPDATE public.branch_inventory
    SET stock = p_new_stock,
        updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  INSERT INTO public.inventory_movements (
    branch_inventory_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reference_type,
    notes,
    created_by
  )
  VALUES (
    v_inventory_id,
    'adjustment',
    p_new_stock - v_previous_stock,
    v_previous_stock,
    p_new_stock,
    'product_stock_set',
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Ajuste de stock desde productos'),
    auth.uid()
  );

  SELECT COALESCE(SUM(bi.stock), 0)::INTEGER
  INTO v_total_stock
  FROM public.branch_inventory bi
  JOIN public.branches b ON b.id = bi.branch_id
  WHERE bi.product_id = p_product_id
    AND bi.variant_id IS NULL
    AND b.organization_id = v_org_id;

  UPDATE public.products
  SET stock = v_total_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'branch_id', p_branch_id,
    'branch_inventory_id', v_inventory_id,
    'previous_stock', v_previous_stock,
    'new_stock', p_new_stock,
    'total_stock', v_total_stock
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_product_stock_with_inventory(UUID, UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_product_stock_with_inventory(UUID, UUID, INTEGER, TEXT)
IS 'Ajusta stock por sucursal (branch_inventory) y recalcula products.stock agregado para compatibilidad.';
