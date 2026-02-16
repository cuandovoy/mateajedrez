-- Fix: decrement_branch_inventory sin llamar a create_inventory_movement
-- La función create_inventory_movement puede no existir en el schema.
-- Este trigger solo actualiza el stock en branch_inventory.

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
      -- Producto: buscar inventario a nivel producto (variant_id NULL) o variante default
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.product_id = NEW.product_id
        AND bi.variant_id IS NULL;

      IF NOT FOUND THEN
        SELECT bi.id, bi.stock
        INTO inventory_entry_id, current_stock
        FROM branch_inventory bi
        JOIN product_variants pv ON pv.id = bi.variant_id
        WHERE bi.branch_id = order_branch_id
          AND bi.variant_id IS NOT NULL
          AND pv.product_id = NEW.product_id
          AND pv.sku LIKE '%-DEFAULT'
          AND pv.is_active = true
        LIMIT 1;
      END IF;
    END IF;

    IF FOUND THEN
      new_stock := current_stock - NEW.quantity;

      UPDATE branch_inventory
      SET stock = new_stock,
          updated_at = NOW()
      WHERE id = inventory_entry_id;
    ELSE
      RAISE EXCEPTION 'Inventory entry not found for product/variant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrement_branch_inventory() IS 'Descuenta stock de branch_inventory al insertar order_items. No requiere create_inventory_movement.';
