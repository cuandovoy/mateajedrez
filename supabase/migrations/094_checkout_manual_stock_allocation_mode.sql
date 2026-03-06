-- Manual stock allocation mode for eCommerce checkout
-- - Adds order status: pending_allocation
-- - Allows creating order_items without immediate stock decrement when status is pending_allocation
-- - Allocates stock when order moves from pending_allocation to an operational status
-- - Avoids restoring stock on cancellation when stock was never allocated

-- ============================================
-- 1) Order status enum
-- ============================================
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_allocation';

-- ============================================
-- 2) Decrement trigger: skip while order is pending_allocation
-- ============================================
CREATE OR REPLACE FUNCTION public.decrement_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  order_status_value public.order_status;
  inventory_entry_id UUID;
  current_stock INTEGER;
  new_stock INTEGER;
BEGIN
  SELECT branch_id, status
  INTO order_branch_id, order_status_value
  FROM public.orders
  WHERE id = NEW.order_id;

  IF order_status_value = 'pending_allocation' THEN
    RETURN NEW;
  END IF;

  IF order_branch_id IS NOT NULL THEN
    IF NEW.variant_id IS NOT NULL THEN
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM public.branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.variant_id = NEW.variant_id;
    ELSE
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM public.branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.product_id = NEW.product_id
        AND bi.variant_id IS NULL;

      IF NOT FOUND THEN
        SELECT bi.id, bi.stock
        INTO inventory_entry_id, current_stock
        FROM public.branch_inventory bi
        JOIN public.product_variants pv ON pv.id = bi.variant_id
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

      UPDATE public.branch_inventory
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

COMMENT ON FUNCTION public.decrement_branch_inventory()
IS 'Descuenta stock en order_items insert. Omite descuento para órdenes en pending_allocation.';

-- ============================================
-- 3) Allocation function + status transition trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.allocate_order_branch_inventory(
  p_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_order_branch_id UUID;
  v_item RECORD;
  v_inventory_entry_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  SELECT o.branch_id
  INTO v_order_branch_id
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_order_branch_id IS NULL THEN
    RAISE EXCEPTION 'Order % does not have a branch assigned', p_order_id;
  END IF;

  FOR v_item IN
    SELECT oi.quantity, oi.variant_id, oi.product_id
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT bi.id, bi.stock
      INTO v_inventory_entry_id, v_current_stock
      FROM public.branch_inventory bi
      WHERE bi.branch_id = v_order_branch_id
        AND bi.variant_id = v_item.variant_id;
    ELSE
      SELECT bi.id, bi.stock
      INTO v_inventory_entry_id, v_current_stock
      FROM public.branch_inventory bi
      WHERE bi.branch_id = v_order_branch_id
        AND bi.product_id = v_item.product_id
        AND bi.variant_id IS NULL;

      IF NOT FOUND THEN
        SELECT bi.id, bi.stock
        INTO v_inventory_entry_id, v_current_stock
        FROM public.branch_inventory bi
        JOIN public.product_variants pv ON pv.id = bi.variant_id
        WHERE bi.branch_id = v_order_branch_id
          AND bi.variant_id IS NOT NULL
          AND pv.product_id = v_item.product_id
          AND pv.sku LIKE '%-DEFAULT'
          AND pv.is_active = true
        LIMIT 1;
      END IF;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory entry not found for product/variant in order %', p_order_id;
    END IF;

    v_new_stock := COALESCE(v_current_stock, 0) - v_item.quantity;

    UPDATE public.branch_inventory
    SET stock = v_new_stock,
        updated_at = NOW()
    WHERE id = v_inventory_entry_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.allocate_order_branch_inventory(UUID)
IS 'Reserva/descuenta stock de todos los items de una orden en su sucursal asignada.';

CREATE OR REPLACE FUNCTION public.trg_allocate_stock_on_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending_allocation'
     AND NEW.status <> 'pending_allocation'
     AND NEW.status <> 'cancelled'
  THEN
    PERFORM public.allocate_order_branch_inventory(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_allocate_stock_on_order_status_transition ON public.orders;
CREATE TRIGGER trigger_allocate_stock_on_order_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_allocate_stock_on_order_status_transition();

-- ============================================
-- 4) Restore trigger: do not restore on cancellation from pending_allocation
-- ============================================
CREATE OR REPLACE FUNCTION public.restore_branch_inventory()
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
  IF NEW.status = 'cancelled'
     AND OLD.status != 'cancelled'
     AND OLD.status != 'pending_allocation'
  THEN
    SELECT branch_id INTO order_branch_id
    FROM public.orders
    WHERE id = NEW.id;

    IF order_branch_id IS NOT NULL THEN
      FOR item_record IN
        SELECT oi.quantity, oi.variant_id, oi.product_id
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
      LOOP
        item_quantity := item_record.quantity;
        variant_id_to_use := item_record.variant_id;
        item_product_id := item_record.product_id;

        IF variant_id_to_use IS NOT NULL THEN
          SELECT bi.id, bi.stock
          INTO inventory_entry_id, current_stock
          FROM public.branch_inventory bi
          WHERE bi.branch_id = order_branch_id
            AND bi.variant_id = variant_id_to_use;
        ELSE
          SELECT bi.id, bi.stock
          INTO inventory_entry_id, current_stock
          FROM public.branch_inventory bi
          WHERE bi.branch_id = order_branch_id
            AND bi.product_id = item_product_id
            AND bi.variant_id IS NULL;

          IF NOT FOUND THEN
            SELECT bi.id, bi.stock
            INTO inventory_entry_id, current_stock
            FROM public.branch_inventory bi
            JOIN public.product_variants pv ON pv.id = bi.variant_id
            WHERE bi.branch_id = order_branch_id
              AND bi.variant_id IS NOT NULL
              AND pv.product_id = item_product_id
              AND pv.sku LIKE '%-DEFAULT'
              AND pv.is_active = true
            LIMIT 1;
          END IF;
        END IF;

        IF FOUND THEN
          new_stock := COALESCE(current_stock, 0) + item_quantity;

          UPDATE public.branch_inventory
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

COMMENT ON FUNCTION public.restore_branch_inventory()
IS 'Restaura stock al cancelar órdenes ya asignadas/descontadas. Omite pending_allocation.';

-- ============================================
-- 5) Order item edit triggers: no stock movement while pending_allocation
-- ============================================
CREATE OR REPLACE FUNCTION public.restore_branch_inventory_on_order_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  order_status_value public.order_status;
  inventory_entry_id UUID;
  current_stock INTEGER;
  new_stock INTEGER;
BEGIN
  SELECT branch_id, status
  INTO order_branch_id, order_status_value
  FROM public.orders
  WHERE id = OLD.order_id;

  IF order_status_value = 'pending_allocation' THEN
    RETURN OLD;
  END IF;

  IF order_branch_id IS NOT NULL THEN
    IF OLD.variant_id IS NOT NULL THEN
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM public.branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.variant_id = OLD.variant_id;
    ELSE
      SELECT bi.id, bi.stock
      INTO inventory_entry_id, current_stock
      FROM public.branch_inventory bi
      WHERE bi.branch_id = order_branch_id
        AND bi.product_id = OLD.product_id
        AND bi.variant_id IS NULL;

      IF NOT FOUND THEN
        SELECT bi.id, bi.stock
        INTO inventory_entry_id, current_stock
        FROM public.branch_inventory bi
        JOIN public.product_variants pv ON pv.id = bi.variant_id
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
      UPDATE public.branch_inventory
      SET stock = new_stock, updated_at = NOW()
      WHERE id = inventory_entry_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.adjust_branch_inventory_on_order_item_update()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  order_status_value public.order_status;
  inventory_entry_id UUID;
  current_stock INTEGER;
  delta INTEGER;
  new_stock INTEGER;
BEGIN
  IF OLD.quantity = NEW.quantity THEN
    RETURN NEW;
  END IF;

  delta := OLD.quantity - NEW.quantity;
  IF delta = 0 THEN
    RETURN NEW;
  END IF;

  SELECT branch_id, status
  INTO order_branch_id, order_status_value
  FROM public.orders
  WHERE id = NEW.order_id;

  IF order_branch_id IS NULL OR order_status_value = 'pending_allocation' THEN
    RETURN NEW;
  END IF;

  IF NEW.variant_id IS NOT NULL THEN
    SELECT bi.id, bi.stock INTO inventory_entry_id, current_stock
    FROM public.branch_inventory bi
    WHERE bi.branch_id = order_branch_id AND bi.variant_id = NEW.variant_id;
  ELSE
    SELECT bi.id, bi.stock INTO inventory_entry_id, current_stock
    FROM public.branch_inventory bi
    WHERE bi.branch_id = order_branch_id
      AND bi.product_id = NEW.product_id
      AND bi.variant_id IS NULL;

    IF NOT FOUND THEN
      SELECT bi.id, bi.stock INTO inventory_entry_id, current_stock
      FROM public.branch_inventory bi
      JOIN public.product_variants pv ON pv.id = bi.variant_id
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
    UPDATE public.branch_inventory
    SET stock = new_stock, updated_at = NOW()
    WHERE id = inventory_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.restore_branch_inventory_on_order_item_delete()
IS 'Restaura stock al eliminar ítems, excepto para órdenes en pending_allocation.';

COMMENT ON FUNCTION public.adjust_branch_inventory_on_order_item_update()
IS 'Ajusta stock al editar cantidad, excepto para órdenes en pending_allocation.';
