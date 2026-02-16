-- Allow negative stock for manual sales (ventas en tienda)
-- Cuando un producto tiene 0 stock, el admin puede registrar la venta igual.
-- El inventario quedará en negativo hasta que se reponga.

-- 1. Drop CHECK constraint on branch_inventory.stock (allow negative)
-- PostgreSQL names inline CHECK as tablename_columnname_check
ALTER TABLE branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_stock_check;

-- 2. Modify decrement_branch_inventory to allow sales even with insufficient stock
-- (no raise exception, just decrement - stock can go negative)
CREATE OR REPLACE FUNCTION decrement_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  inventory_entry_id UUID;
  current_stock INTEGER;
  new_stock INTEGER;
BEGIN
  SELECT branch_id INTO order_branch_id
  FROM orders
  WHERE id = NEW.order_id;

  IF order_branch_id IS NOT NULL THEN
    IF NEW.variant_id IS NOT NULL THEN
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.variant_id = NEW.variant_id;
    ELSE
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.product_id = NEW.product_id
        AND bi.variant_id IS NULL;
    END IF;

    IF FOUND THEN
      -- Allow decrement even when insufficient (stock can go negative)
      new_stock := current_stock - NEW.quantity;

      UPDATE branch_inventory
      SET stock = new_stock,
          updated_at = NOW()
      WHERE id = inventory_entry_id;

      PERFORM create_inventory_movement(
        inventory_entry_id,
        'sale',
        -NEW.quantity,
        current_stock,
        new_stock,
        NEW.order_id,
        'order',
        'Venta - Orden #' || NEW.order_id::TEXT,
        NULL
      );
    ELSE
      RAISE EXCEPTION 'Inventory entry not found for product/variant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrement_branch_inventory() IS 'Descuenta stock de branch_inventory. Permite stock negativo para ventas manuales.';
