CREATE OR REPLACE FUNCTION public.cancel_inventory_transfer(
  p_transfer_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_transfer RECORD;
  v_from_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
  v_reference_type TEXT;
BEGIN
  SELECT * INTO v_transfer
  FROM public.inventory_transfers
  WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar transferencias pendientes';
  END IF;

  IF v_transfer.variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM public.branch_inventory
    WHERE branch_id = v_transfer.from_branch_id
      AND variant_id = v_transfer.variant_id
      AND product_id IS NULL;
  ELSE
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM public.branch_inventory
    WHERE branch_id = v_transfer.from_branch_id
      AND product_id = v_transfer.product_id
      AND variant_id IS NULL;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventario de origen no encontrado';
  END IF;

  v_new_stock := v_previous_stock + v_transfer.quantity;

  UPDATE public.branch_inventory
  SET stock = v_new_stock,
      updated_at = NOW()
  WHERE id = v_from_inventory_id;

  UPDATE public.inventory_transfers
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_transfer_id;

  v_reference_type := CASE
    WHEN COALESCE(v_transfer.transfer_type, 'regular') = 'regular' THEN 'transfer'
    ELSE v_transfer.transfer_type
  END;

  PERFORM public.create_inventory_movement(
    v_from_inventory_id,
    'adjustment',
    v_transfer.quantity,
    v_previous_stock,
    v_new_stock,
    p_transfer_id,
    v_reference_type,
    'Transferencia cancelada - stock restituido',
    NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cancel_inventory_transfer(UUID)
IS 'Cancela una transferencia pendiente y restituye el stock a la sucursal origen.';
