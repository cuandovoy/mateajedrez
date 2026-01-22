-- Fix all calls to create_inventory_movement to include p_supplier_id parameter
-- This resolves the function ambiguity error

-- Update adjust_inventory function
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_branch_inventory_id UUID,
  p_new_stock INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_previous_stock INTEGER;
  v_quantity INTEGER;
  v_movement_id UUID;
BEGIN
  -- Get current stock
  SELECT stock INTO v_previous_stock
  FROM branch_inventory
  WHERE id = p_branch_inventory_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory entry not found';
  END IF;
  
  -- Calculate quantity change
  v_quantity := p_new_stock - v_previous_stock;
  
  -- Update stock
  UPDATE branch_inventory
  SET stock = p_new_stock,
      updated_at = NOW()
  WHERE id = p_branch_inventory_id;
  
  -- Create movement record (no supplier for adjustments)
  v_movement_id := create_inventory_movement(
    p_branch_inventory_id,
    'adjustment',
    v_quantity,
    v_previous_stock,
    p_new_stock,
    NULL,
    'manual',
    p_notes,
    NULL  -- p_supplier_id (no supplier for adjustments)
  );
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_inventory_transfer function
CREATE OR REPLACE FUNCTION create_inventory_transfer(
  p_from_branch_id UUID,
  p_to_branch_id UUID,
  p_quantity INTEGER,
  p_product_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_user_id UUID;
  v_from_inventory_id UUID;
  v_previous_stock INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than 0';
  END IF;
  
  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same branch';
  END IF;
  
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Find source inventory entry
  IF p_variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = p_from_branch_id
    AND variant_id = p_variant_id
    AND product_id IS NULL;
  ELSE
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = p_from_branch_id
    AND product_id = p_product_id
    AND variant_id IS NULL;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source inventory entry not found';
  END IF;
  
  IF v_previous_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for transfer. Available: %, Requested: %', v_previous_stock, p_quantity;
  END IF;
  
  -- Create transfer record
  INSERT INTO inventory_transfers (
    from_branch_id,
    to_branch_id,
    product_id,
    variant_id,
    quantity,
    status,
    notes,
    created_by
  )
  VALUES (
    p_from_branch_id,
    p_to_branch_id,
    p_product_id,
    p_variant_id,
    p_quantity,
    'pending',
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_transfer_id;
  
  -- Decrease stock from source branch
  UPDATE branch_inventory
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE id = v_from_inventory_id;
  
  -- Create movement record for source branch (no supplier for transfers)
  PERFORM create_inventory_movement(
    v_from_inventory_id,
    'transfer_out',
    -p_quantity,
    v_previous_stock,
    v_previous_stock - p_quantity,
    v_transfer_id,
    'transfer',
    p_notes,
    NULL  -- p_supplier_id (no supplier for transfers)
  );
  
  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update complete_inventory_transfer function
CREATE OR REPLACE FUNCTION complete_inventory_transfer(
  p_transfer_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_transfer RECORD;
  v_to_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
  v_movement_id UUID;
BEGIN
  -- Get transfer details
  SELECT * INTO v_transfer
  FROM inventory_transfers
  WHERE id = p_transfer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;
  
  IF v_transfer.status != 'pending' THEN
    RAISE EXCEPTION 'Transfer is not pending';
  END IF;
  
  -- Find or create destination inventory entry
  IF v_transfer.variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_to_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = v_transfer.to_branch_id
    AND variant_id = v_transfer.variant_id
    AND product_id IS NULL;
  ELSE
    SELECT id, stock INTO v_to_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = v_transfer.to_branch_id
    AND product_id = v_transfer.product_id
    AND variant_id IS NULL;
  END IF;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination inventory entry not found';
  END IF;
  
  -- Calculate new stock
  v_new_stock := v_previous_stock + v_transfer.quantity;
  
  -- Update stock
  UPDATE branch_inventory
  SET stock = v_new_stock,
      updated_at = NOW()
  WHERE id = v_to_inventory_id;
  
  -- Mark transfer as completed
  UPDATE inventory_transfers
  SET status = 'completed',
      completed_at = NOW(),
      completed_by = auth.uid()
  WHERE id = p_transfer_id;
  
  -- Create movement record for destination branch (no supplier for transfers)
  v_movement_id := create_inventory_movement(
    v_to_inventory_id,
    'transfer_in',
    v_transfer.quantity,
    v_previous_stock,
    v_new_stock,
    p_transfer_id,
    'transfer',
    v_transfer.notes,
    NULL  -- p_supplier_id (no supplier for transfers)
  );
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update decrement_branch_inventory trigger function
CREATE OR REPLACE FUNCTION decrement_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  inventory_entry_id UUID;
  current_stock INTEGER;
  new_stock INTEGER;
BEGIN
  -- Get the branch_id from the order
  SELECT branch_id INTO order_branch_id
  FROM orders
  WHERE id = NEW.order_id;

  -- Only proceed if branch_id exists
  IF order_branch_id IS NOT NULL THEN
    -- Get inventory entry ID and current stock
    -- Handle both variant-based and product-based inventory
    IF NEW.variant_id IS NOT NULL THEN
      -- Decrement stock for variant
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.variant_id = NEW.variant_id;
    ELSE
      -- Decrement stock for product (no variant)
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.product_id = NEW.product_id
        AND bi.variant_id IS NULL;
    END IF;

    -- If inventory entry exists, decrement stock
    IF FOUND THEN
      -- Check stock availability
      IF current_stock < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, NEW.quantity;
      END IF;

      -- Calculate new stock
      new_stock := current_stock - NEW.quantity;

      -- Decrement stock from branch_inventory
      UPDATE branch_inventory
      SET stock = new_stock,
          updated_at = NOW()
      WHERE id = inventory_entry_id;

      -- Record movement (no supplier for sales)
      PERFORM create_inventory_movement(
        inventory_entry_id,
        'sale',
        -NEW.quantity,
        current_stock,
        new_stock,
        NEW.order_id,
        'order',
        'Venta - Orden #' || NEW.order_id::TEXT,
        NULL  -- p_supplier_id (no supplier for sales)
      );
    ELSE
      RAISE EXCEPTION 'Inventory entry not found for product/variant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update restore_branch_inventory trigger function
CREATE OR REPLACE FUNCTION restore_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  inventory_entry_id UUID;
  current_stock INTEGER;
  new_stock INTEGER;
  item_quantity INTEGER;
  variant_id_to_use UUID;
  item_product_id UUID;
  item_record RECORD;
BEGIN
  -- Only restore stock if order status changed to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Get the branch_id from the order
    SELECT branch_id INTO order_branch_id
    FROM orders
    WHERE id = NEW.id;

    -- Only proceed if branch_id exists
    IF order_branch_id IS NOT NULL THEN
      -- Loop through all order items and restore stock
      FOR item_record IN
        SELECT 
          oi.quantity,
          oi.variant_id,  -- Use variant_id directly (can be NULL for products without variants)
          oi.product_id
        FROM order_items oi
        WHERE oi.order_id = NEW.id
      LOOP
        item_quantity := item_record.quantity;
        variant_id_to_use := item_record.variant_id;
        item_product_id := item_record.product_id;

        -- Get inventory entry ID and current stock
        -- Handle both variant-based and product-based inventory
        IF variant_id_to_use IS NOT NULL THEN
          -- Restore stock for variant
          SELECT bi.id, bi.stock
          INTO inventory_entry_id, current_stock
          FROM branch_inventory bi
          WHERE bi.branch_id = order_branch_id
            AND bi.variant_id = variant_id_to_use;
        ELSE
          -- Restore stock for product (no variant)
          SELECT bi.id, bi.stock
          INTO inventory_entry_id, current_stock
          FROM branch_inventory bi
          WHERE bi.branch_id = order_branch_id
            AND bi.product_id = item_product_id
            AND bi.variant_id IS NULL;
        END IF;

        -- If inventory entry exists, restore stock
        IF FOUND THEN
          new_stock := current_stock + item_quantity;

          -- Update stock
          UPDATE branch_inventory
          SET stock = new_stock,
              updated_at = NOW()
          WHERE id = inventory_entry_id;

          -- Record movement (no supplier for returns)
          PERFORM create_inventory_movement(
            inventory_entry_id,
            'return',
            item_quantity,
            current_stock,
            new_stock,
            NEW.id,
            'order',
            'Devolución - Orden #' || NEW.id::TEXT || ' cancelada',
            NULL  -- p_supplier_id (no supplier for returns)
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION adjust_inventory(UUID, INTEGER, TEXT) IS 'Ajusta manualmente el stock de un inventario';
COMMENT ON FUNCTION create_inventory_transfer(UUID, UUID, INTEGER, UUID, UUID, TEXT) IS 'Crea una transferencia de stock entre sucursales';
COMMENT ON FUNCTION complete_inventory_transfer(UUID) IS 'Completa una transferencia recibiendo el stock en la sucursal destino';
