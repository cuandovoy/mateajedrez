-- Step 4: complete_inventory_transfer con creación automática de inventario destino
-- Requiere que ya estén aplicados:
-- - Paso 1 (branches.can_receive y demás campos)
-- - Paso 2 (inventory_transfers.transfer_type)

CREATE OR REPLACE FUNCTION public.complete_inventory_transfer(
  p_transfer_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_transfer RECORD;
  v_to_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
  v_movement_id UUID;
  v_to_can_receive BOOLEAN;
  v_reference_type TEXT;
BEGIN
  SELECT * INTO v_transfer
  FROM public.inventory_transfers
  WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer is not pending';
  END IF;

  SELECT COALESCE(b.can_receive, TRUE)
  INTO v_to_can_receive
  FROM public.branches b
  WHERE b.id = v_transfer.to_branch_id;

  IF v_to_can_receive IS NULL THEN
    RAISE EXCEPTION 'Destination branch not found';
  END IF;

  IF NOT v_to_can_receive THEN
    RAISE EXCEPTION 'Destination branch is not allowed to receive inventory';
  END IF;

  IF v_transfer.variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_to_inventory_id, v_previous_stock
    FROM public.branch_inventory
    WHERE branch_id = v_transfer.to_branch_id
      AND variant_id = v_transfer.variant_id
      AND product_id IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold
      )
      SELECT
        v_transfer.to_branch_id,
        NULL,
        v_transfer.variant_id,
        0,
        COALESCE(pv.min_stock, 0),
        COALESCE(pv.low_stock_threshold, 10)
      FROM public.product_variants pv
      WHERE pv.id = v_transfer.variant_id
      RETURNING id, stock
      INTO v_to_inventory_id, v_previous_stock;
    END IF;
  ELSE
    SELECT id, stock INTO v_to_inventory_id, v_previous_stock
    FROM public.branch_inventory
    WHERE branch_id = v_transfer.to_branch_id
      AND product_id = v_transfer.product_id
      AND variant_id IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold
      )
      SELECT
        v_transfer.to_branch_id,
        v_transfer.product_id,
        NULL,
        0,
        COALESCE(p.min_stock, 0),
        COALESCE(p.low_stock_threshold, 10)
      FROM public.products p
      WHERE p.id = v_transfer.product_id
      RETURNING id, stock
      INTO v_to_inventory_id, v_previous_stock;
    END IF;
  END IF;

  IF v_to_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Destination inventory entry could not be created';
  END IF;

  v_new_stock := v_previous_stock + v_transfer.quantity;

  UPDATE public.branch_inventory
  SET stock = v_new_stock,
      updated_at = NOW()
  WHERE id = v_to_inventory_id;

  UPDATE public.inventory_transfers
  SET status = 'completed',
      completed_at = NOW(),
      completed_by = auth.uid()
  WHERE id = p_transfer_id;

  v_reference_type := CASE
    WHEN COALESCE(v_transfer.transfer_type, 'regular') = 'regular' THEN 'transfer'
    ELSE v_transfer.transfer_type
  END;

  v_movement_id := public.create_inventory_movement(
    v_to_inventory_id,
    'transfer_in',
    v_transfer.quantity,
    v_previous_stock,
    v_new_stock,
    p_transfer_id,
    v_reference_type,
    v_transfer.notes,
    NULL
  );

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.complete_inventory_transfer(UUID)
IS 'Completa una transferencia y crea automáticamente el inventario destino cuando no existe.';
