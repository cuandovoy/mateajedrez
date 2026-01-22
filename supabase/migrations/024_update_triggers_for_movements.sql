-- Update stock triggers to record movements in inventory_movements
-- This ensures all stock changes (sales, returns, etc.) are tracked

-- Update decrement_branch_inventory to record movements
CREATE OR REPLACE FUNCTION decrement_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  variant_id_to_use UUID;
  current_stock INTEGER;
  new_stock INTEGER;
  variant_name VARCHAR;
  variant_sku VARCHAR;
  inventory_entry_id UUID;
BEGIN
  -- Get the branch_id from the order
  SELECT branch_id INTO order_branch_id
  FROM orders
  WHERE id = NEW.order_id;

  -- Validate that order has a branch_id
  IF order_branch_id IS NULL THEN
    RAISE EXCEPTION 'Order % does not have a branch_id. All orders must be assigned to a branch.', NEW.order_id;
  END IF;

  -- Determine which inventory entry to use
  IF NEW.variant_id IS NOT NULL THEN
    -- Use specific variant inventory
    variant_id_to_use := NEW.variant_id;
    
    -- Get current stock and inventory entry ID from branch_inventory for variant
    SELECT bi.id, bi.stock, pv.name, pv.sku 
    INTO inventory_entry_id, current_stock, variant_name, variant_sku
    FROM branch_inventory bi
    INNER JOIN product_variants pv ON bi.variant_id = pv.id
    WHERE bi.branch_id = order_branch_id
      AND bi.variant_id = variant_id_to_use;

    -- Check if inventory entry exists
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory entry not found for variant % in branch %. Please ensure inventory is set up.', 
        variant_id_to_use, order_branch_id;
    END IF;
  ELSE
    -- Product without variant - use product-level inventory
    variant_id_to_use := NULL;
    
    -- Get current stock and inventory entry ID from branch_inventory for product
    SELECT bi.id, bi.stock, p.name, p.sku 
    INTO inventory_entry_id, current_stock, variant_name, variant_sku
    FROM branch_inventory bi
    INNER JOIN products p ON bi.product_id = p.id
    WHERE bi.branch_id = order_branch_id
      AND bi.product_id = NEW.product_id
      AND bi.variant_id IS NULL;

    -- Check if inventory entry exists
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory entry not found for product % in branch %. Please ensure inventory is set up.', 
        NEW.product_id, order_branch_id;
    END IF;
  END IF;

  -- Check if there's enough stock
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for variant "%" (SKU: %) in branch. Available: %, Requested: %', 
      variant_name, variant_sku, current_stock, NEW.quantity;
  END IF;

  -- Calculate new stock
  new_stock := current_stock - NEW.quantity;

  -- Decrement stock from branch_inventory
  UPDATE branch_inventory
  SET stock = new_stock,
      updated_at = NOW()
  WHERE id = inventory_entry_id;

  -- Record movement
  PERFORM create_inventory_movement(
    inventory_entry_id,
    'sale',
    -NEW.quantity,
    current_stock,
    new_stock,
    NEW.order_id,
    'order',
    'Venta - Orden #' || NEW.order_id::TEXT
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update restore_branch_inventory to record movements
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

          -- Record movement
          PERFORM create_inventory_movement(
            inventory_entry_id,
            'return',
            item_quantity,
            current_stock,
            new_stock,
            NEW.id,
            'order',
            'Devolución - Orden #' || NEW.id::TEXT || ' cancelada'
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrement_branch_inventory() IS 'Descuenta stock de branch_inventory y registra el movimiento en inventory_movements';
COMMENT ON FUNCTION restore_branch_inventory() IS 'Restaura stock a branch_inventory y registra el movimiento en inventory_movements';
