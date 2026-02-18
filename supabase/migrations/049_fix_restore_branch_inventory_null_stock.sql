-- Fix: "null value in column stock of relation branch_inventory" al cancelar orden.
-- Si current_stock es NULL, new_stock = NULL + quantity = NULL y el UPDATE falla.
-- Solución: COALESCE(current_stock, 0) en restore y decrement.
-- Restore: también fallback para variante default (consistencia con decrement).

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
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    SELECT branch_id INTO order_branch_id
    FROM orders
    WHERE id = NEW.id;

    IF order_branch_id IS NOT NULL THEN
      FOR item_record IN
        SELECT oi.quantity, oi.variant_id, oi.product_id
        FROM order_items oi
        WHERE oi.order_id = NEW.id
      LOOP
        item_quantity := item_record.quantity;
        variant_id_to_use := item_record.variant_id;
        item_product_id := item_record.product_id;

        IF variant_id_to_use IS NOT NULL THEN
          SELECT bi.id, bi.stock
          INTO inventory_entry_id, current_stock
          FROM branch_inventory bi
          WHERE bi.branch_id = order_branch_id
            AND bi.variant_id = variant_id_to_use;
        ELSE
          -- Producto sin variante: buscar product_id + variant NULL
          SELECT bi.id, bi.stock
          INTO inventory_entry_id, current_stock
          FROM branch_inventory bi
          WHERE bi.branch_id = order_branch_id
            AND bi.product_id = item_product_id
            AND bi.variant_id IS NULL;

          -- Fallback: variante default (igual que decrement_branch_inventory)
          IF NOT FOUND THEN
            SELECT bi.id, bi.stock
            INTO inventory_entry_id, current_stock
            FROM branch_inventory bi
            JOIN product_variants pv ON pv.id = bi.variant_id
            WHERE bi.branch_id = order_branch_id
              AND bi.variant_id IS NOT NULL
              AND pv.product_id = item_product_id
              AND pv.sku LIKE '%-DEFAULT'
              AND pv.is_active = true
            LIMIT 1;
          END IF;
        END IF;

        IF FOUND THEN
          -- COALESCE evita NULL cuando stock está corrupto o en edge cases
          new_stock := COALESCE(current_stock, 0) + item_quantity;

          UPDATE branch_inventory
          SET stock = new_stock,
              updated_at = NOW()
          WHERE id = inventory_entry_id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restore_branch_inventory() IS 'Restaura stock a branch_inventory al cancelar orden. Usa COALESCE para evitar NULL en stock.';

-- También fix en decrement_branch_inventory (por consistencia)
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
      new_stock := COALESCE(current_stock, 0) - NEW.quantity;

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

COMMENT ON FUNCTION decrement_branch_inventory() IS 'Descuenta stock de branch_inventory. COALESCE evita NULL en stock.';
