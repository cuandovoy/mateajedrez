-- Fix runtime errors in order return RPCs due to create_audit_log signature mismatch.
-- Root cause:
-- - create_audit_log expects p_record_id UUID (not TEXT)
-- - function signature does not include changed_fields argument

CREATE OR REPLACE FUNCTION create_full_order_cancellation(
  p_order_id UUID,
  p_reason TEXT,
  p_refund_method VARCHAR(50) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_return_id UUID;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id es requerido';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;

  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_member(v_order.organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'La orden % ya está cancelada', p_order_id;
  END IF;

  INSERT INTO order_returns (
    organization_id,
    order_id,
    return_type,
    status,
    reason,
    refund_amount,
    refund_method,
    notes,
    created_by,
    posted_by,
    posted_at
  )
  VALUES (
    v_order.organization_id,
    v_order.id,
    'full',
    'posted',
    TRIM(p_reason),
    COALESCE(v_order.total, 0),
    p_refund_method,
    p_notes,
    auth.uid(),
    auth.uid(),
    NOW()
  )
  RETURNING id INTO v_return_id;

  INSERT INTO order_return_items (
    organization_id,
    order_return_id,
    order_item_id,
    product_id,
    variant_id,
    quantity,
    unit_price,
    line_total
  )
  SELECT
    v_order.organization_id,
    v_return_id,
    oi.id,
    oi.product_id,
    oi.variant_id,
    oi.quantity,
    oi.price,
    (oi.quantity * oi.price)::NUMERIC(12,2)
  FROM order_items oi
  WHERE oi.order_id = v_order.id;

  UPDATE orders
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = v_order.id;

  PERFORM create_audit_log(
    'orders',
    v_order.id,
    'UPDATE',
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled', 'reason', TRIM(p_reason), 'order_return_id', v_return_id),
    'Anulación completa de orden con devolución total',
    v_order.organization_id
  );

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION process_partial_order_return(
  p_order_id UUID,
  p_reason TEXT,
  p_items JSONB,
  p_refund_method VARCHAR(50) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_order_item RECORD;
  v_item JSONB;
  v_return_qty INTEGER;
  v_return_id UUID;
  v_refund_total NUMERIC(12,2) := 0;
  v_branch_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id es requerido';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'El motivo de devolución es obligatorio';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debes indicar al menos un item para devolver';
  END IF;

  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_member(v_order.organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'La orden % está cancelada. Usa el flujo de anulación completa.', p_order_id;
  END IF;

  INSERT INTO order_returns (
    organization_id,
    order_id,
    return_type,
    status,
    reason,
    refund_amount,
    refund_method,
    notes,
    created_by,
    posted_by,
    posted_at
  )
  VALUES (
    v_order.organization_id,
    v_order.id,
    'partial',
    'posted',
    TRIM(p_reason),
    0,
    p_refund_method,
    p_notes,
    auth.uid(),
    auth.uid(),
    NOW()
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_return_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);

    IF v_return_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en devolución parcial';
    END IF;

    SELECT
      oi.id,
      oi.product_id,
      oi.variant_id,
      oi.quantity,
      oi.returned_quantity,
      oi.price
    INTO v_order_item
    FROM order_items oi
    WHERE oi.id = (v_item->>'order_item_id')::UUID
      AND oi.order_id = v_order.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item de orden no encontrado: %', v_item->>'order_item_id';
    END IF;

    IF (v_order_item.returned_quantity + v_return_qty) > v_order_item.quantity THEN
      RAISE EXCEPTION
        'Cantidad a devolver (%) supera disponible para devolver (%) en item %',
        v_return_qty,
        (v_order_item.quantity - v_order_item.returned_quantity),
        v_order_item.id;
    END IF;

    UPDATE order_items
    SET returned_quantity = returned_quantity + v_return_qty
    WHERE id = v_order_item.id;

    INSERT INTO order_return_items (
      organization_id,
      order_return_id,
      order_item_id,
      product_id,
      variant_id,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      v_order.organization_id,
      v_return_id,
      v_order_item.id,
      v_order_item.product_id,
      v_order_item.variant_id,
      v_return_qty,
      v_order_item.price,
      (v_return_qty * v_order_item.price)::NUMERIC(12,2)
    );

    v_refund_total := v_refund_total + (v_return_qty * v_order_item.price);

    IF v_order_item.variant_id IS NOT NULL THEN
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
      VALUES (v_order.branch_id, NULL, v_order_item.variant_id, 0, 0, 10)
      ON CONFLICT (branch_id, variant_id) WHERE variant_id IS NOT NULL DO NOTHING;

      SELECT id, stock
      INTO v_branch_inventory_id, v_previous_stock
      FROM branch_inventory
      WHERE branch_id = v_order.branch_id
        AND variant_id = v_order_item.variant_id
        AND product_id IS NULL
      FOR UPDATE;
    ELSE
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
      VALUES (v_order.branch_id, v_order_item.product_id, NULL, 0, 0, 10)
      ON CONFLICT (branch_id, product_id) WHERE product_id IS NOT NULL DO NOTHING;

      SELECT id, stock
      INTO v_branch_inventory_id, v_previous_stock
      FROM branch_inventory
      WHERE branch_id = v_order.branch_id
        AND product_id = v_order_item.product_id
        AND variant_id IS NULL
      FOR UPDATE;
    END IF;

    IF v_branch_inventory_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró entrada de inventario para devolver item %', v_order_item.id;
    END IF;

    v_new_stock := COALESCE(v_previous_stock, 0) + v_return_qty;

    UPDATE branch_inventory
    SET stock = v_new_stock,
        updated_at = NOW()
    WHERE id = v_branch_inventory_id;

    INSERT INTO inventory_movements (
      branch_inventory_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reference_id,
      reference_type,
      notes,
      created_by,
      created_at
    )
    VALUES (
      v_branch_inventory_id,
      'return',
      v_return_qty,
      COALESCE(v_previous_stock, 0),
      v_new_stock,
      v_return_id,
      'order_return',
      'Devolución parcial - Orden #' || v_order.id::TEXT,
      auth.uid(),
      NOW()
    );
  END LOOP;

  UPDATE order_returns
  SET refund_amount = v_refund_total,
      updated_at = NOW()
  WHERE id = v_return_id;

  PERFORM create_audit_log(
    'order_returns',
    v_return_id,
    'INSERT',
    NULL,
    jsonb_build_object(
      'order_id', v_order.id,
      'return_type', 'partial',
      'refund_amount', v_refund_total,
      'reason', TRIM(p_reason)
    ),
    'Devolución parcial de venta',
    v_order.organization_id
  );

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_full_order_cancellation(UUID, TEXT, VARCHAR, TEXT)
IS 'Anula una orden completa con motivo y registro de auditoría compatible con create_audit_log vigente.';

COMMENT ON FUNCTION process_partial_order_return(UUID, TEXT, JSONB, VARCHAR, TEXT)
IS 'Procesa devolución parcial y registra auditoría compatible con create_audit_log vigente.';
