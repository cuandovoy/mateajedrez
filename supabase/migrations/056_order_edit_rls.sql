-- Migration: 056_order_edit_rls.sql
-- RLS policies para permitir editar órdenes (order_items, order_payments) por admins de la org
-- Trigger para restaurar stock al eliminar un order_item

-- Función: restaurar stock al eliminar order_item (inverso de decrement_branch_inventory)
CREATE OR REPLACE FUNCTION restore_branch_inventory_on_order_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  inventory_entry_id UUID;
  current_stock INTEGER;
  new_stock INTEGER;
BEGIN
  SELECT branch_id INTO order_branch_id
  FROM orders
  WHERE id = OLD.order_id;

  IF order_branch_id IS NOT NULL THEN
    IF OLD.variant_id IS NOT NULL THEN
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.variant_id = OLD.variant_id;
    ELSE
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.product_id = OLD.product_id
        AND bi.variant_id IS NULL;

      IF NOT FOUND THEN
        SELECT bi.id, bi.stock
        INTO inventory_entry_id, current_stock
        FROM branch_inventory bi
        JOIN product_variants pv ON pv.id = bi.variant_id
        WHERE bi.branch_id = order_branch_id
          AND bi.variant_id IS NOT NULL
          AND pv.product_id = OLD.product_id
          AND pv.sku LIKE '%-DEFAULT'
          AND pv.is_active = true
        LIMIT 1;
      END IF;
    END IF;

    IF FOUND THEN
      new_stock := COALESCE(current_stock, 0) + OLD.quantity;
      UPDATE branch_inventory
      SET stock = new_stock, updated_at = NOW()
      WHERE id = inventory_entry_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_restore_stock_on_order_item_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION restore_branch_inventory_on_order_item_delete();

-- Función: ajustar stock al actualizar quantity de order_item
CREATE OR REPLACE FUNCTION adjust_branch_inventory_on_order_item_update()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  inventory_entry_id UUID;
  current_stock INTEGER;
  delta INTEGER;
  new_stock INTEGER;
BEGIN
  IF OLD.quantity = NEW.quantity THEN
    RETURN NEW;
  END IF;

  delta := OLD.quantity - NEW.quantity;
  IF delta = 0 THEN RETURN NEW; END IF;

  SELECT branch_id INTO order_branch_id
  FROM orders WHERE id = NEW.order_id;

  IF order_branch_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.variant_id IS NOT NULL THEN
    SELECT bi.id, bi.stock INTO inventory_entry_id, current_stock
    FROM branch_inventory bi
    WHERE bi.branch_id = order_branch_id AND bi.variant_id = NEW.variant_id;
  ELSE
    SELECT bi.id, bi.stock INTO inventory_entry_id, current_stock
    FROM branch_inventory bi
    WHERE bi.branch_id = order_branch_id
      AND bi.product_id = NEW.product_id
      AND bi.variant_id IS NULL;

    IF NOT FOUND THEN
      SELECT bi.id, bi.stock INTO inventory_entry_id, current_stock
      FROM branch_inventory bi
      JOIN product_variants pv ON pv.id = bi.variant_id
      WHERE bi.branch_id = order_branch_id
        AND pv.product_id = NEW.product_id
        AND pv.sku LIKE '%-DEFAULT'
        AND pv.is_active = true
      LIMIT 1;
    END IF;
  END IF;

  IF FOUND THEN
    new_stock := COALESCE(current_stock, 0) + delta;
    IF new_stock < 0 THEN
      RAISE EXCEPTION 'Insufficient stock: cannot reduce quantity below available';
    END IF;
    UPDATE branch_inventory
    SET stock = new_stock, updated_at = NOW()
    WHERE id = inventory_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_adjust_stock_on_order_item_update
  AFTER UPDATE OF quantity ON order_items
  FOR EACH ROW
  WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
  EXECUTE FUNCTION adjust_branch_inventory_on_order_item_update();

-- Order items: UPDATE y DELETE por org admin/manager
CREATE POLICY "Order items update via order org admin"
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

CREATE POLICY "Order items delete via order org admin"
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

-- Order payments: UPDATE por org admin/manager
CREATE POLICY "Order payments update via order org admin"
  ON order_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
      AND o.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );
