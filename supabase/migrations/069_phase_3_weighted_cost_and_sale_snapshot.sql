-- Phase 3 (part 1): weighted average cost per branch + cost snapshot at sale
-- Scope:
-- 1) Persist weighted average cost in branch_inventory
-- 2) Persist cost_at_sale / margin_at_sale in order_items (immutable snapshot)
-- 3) Update weighted average when posting goods receipts

-- =============================================================================
-- 1) SCHEMA CHANGES
-- =============================================================================

ALTER TABLE branch_inventory
  ADD COLUMN IF NOT EXISTS avg_unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_purchase_unit_cost NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMPTZ;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS margin_at_sale NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS margin_percentage_at_sale NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS cost_source VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_avg_cost
  ON branch_inventory(branch_id, avg_unit_cost);

CREATE INDEX IF NOT EXISTS idx_order_items_order_cost_snapshot
  ON order_items(order_id, cost_at_sale);

-- =============================================================================
-- 2) HELPER: cost snapshot at sale
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_set_order_item_cost_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_branch_id UUID;
  v_avg_unit_cost NUMERIC(12,4);
  v_revenue NUMERIC(14,4);
  v_total_cost NUMERIC(14,4);
BEGIN
  SELECT branch_id
  INTO v_branch_id
  FROM orders
  WHERE id = NEW.order_id;

  IF v_branch_id IS NULL THEN
    NEW.cost_at_sale := NULL;
    NEW.margin_at_sale := NULL;
    NEW.margin_percentage_at_sale := NULL;
    NEW.cost_source := 'branch_missing';
    RETURN NEW;
  END IF;

  IF NEW.variant_id IS NOT NULL THEN
    SELECT bi.avg_unit_cost
    INTO v_avg_unit_cost
    FROM branch_inventory bi
    WHERE bi.branch_id = v_branch_id
      AND bi.variant_id = NEW.variant_id
      AND bi.product_id IS NULL
    LIMIT 1;
  ELSE
    SELECT bi.avg_unit_cost
    INTO v_avg_unit_cost
    FROM branch_inventory bi
    WHERE bi.branch_id = v_branch_id
      AND bi.product_id = NEW.product_id
      AND bi.variant_id IS NULL
    LIMIT 1;
  END IF;

  IF v_avg_unit_cost IS NULL THEN
    NEW.cost_at_sale := NULL;
    NEW.margin_at_sale := NULL;
    NEW.margin_percentage_at_sale := NULL;
    NEW.cost_source := 'inventory_cost_missing';
    RETURN NEW;
  END IF;

  v_revenue := COALESCE(NEW.price, 0)::NUMERIC(14,4) * COALESCE(NEW.quantity, 0)::NUMERIC(14,4);
  v_total_cost := v_avg_unit_cost * COALESCE(NEW.quantity, 0)::NUMERIC(14,4);

  NEW.cost_at_sale := v_avg_unit_cost;
  NEW.margin_at_sale := ROUND(v_revenue - v_total_cost, 4);
  NEW.margin_percentage_at_sale := CASE
    WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_total_cost) / v_revenue) * 100, 4)
    ELSE NULL
  END;
  NEW.cost_source := 'weighted_average_branch';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_item_cost_snapshot ON order_items;
CREATE TRIGGER set_order_item_cost_snapshot
  BEFORE INSERT OR UPDATE OF order_id, product_id, variant_id, quantity, price
  ON order_items
  FOR EACH ROW EXECUTE FUNCTION trg_set_order_item_cost_snapshot();

-- =============================================================================
-- 3) POST GOODS RECEIPT: update weighted average cost
-- =============================================================================

CREATE OR REPLACE FUNCTION post_goods_receipt(p_goods_receipt_id UUID)
RETURNS UUID AS $$
DECLARE
  v_receipt goods_receipts%ROWTYPE;
  v_item RECORD;
  v_branch_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
  v_previous_avg_cost NUMERIC(12,4);
  v_effective_previous_qty NUMERIC(14,4);
  v_new_avg_cost NUMERIC(12,4);
  v_has_supplier_column BOOLEAN;
BEGIN
  SELECT *
  INTO v_receipt
  FROM goods_receipts
  WHERE id = p_goods_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'goods_receipt % not found', p_goods_receipt_id;
  END IF;

  IF v_receipt.status <> 'draft' THEN
    RAISE EXCEPTION 'goods_receipt % is not in draft status', p_goods_receipt_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM goods_receipt_items WHERE goods_receipt_id = p_goods_receipt_id) THEN
    RAISE EXCEPTION 'goods_receipt % has no items', p_goods_receipt_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_movements'
      AND column_name = 'supplier_id'
  )
  INTO v_has_supplier_column;

  FOR v_item IN
    SELECT *
    FROM goods_receipt_items
    WHERE goods_receipt_id = p_goods_receipt_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      INSERT INTO branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold,
        avg_unit_cost
      )
      VALUES (v_receipt.branch_id, NULL, v_item.variant_id, 0, 0, 10, 0)
      ON CONFLICT (branch_id, variant_id) WHERE variant_id IS NOT NULL DO NOTHING;

      SELECT id, stock, avg_unit_cost
      INTO v_branch_inventory_id, v_previous_stock, v_previous_avg_cost
      FROM branch_inventory
      WHERE branch_id = v_receipt.branch_id
        AND variant_id = v_item.variant_id
        AND product_id IS NULL
      FOR UPDATE;
    ELSE
      INSERT INTO branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold,
        avg_unit_cost
      )
      VALUES (v_receipt.branch_id, v_item.product_id, NULL, 0, 0, 10, 0)
      ON CONFLICT (branch_id, product_id) WHERE product_id IS NOT NULL DO NOTHING;

      SELECT id, stock, avg_unit_cost
      INTO v_branch_inventory_id, v_previous_stock, v_previous_avg_cost
      FROM branch_inventory
      WHERE branch_id = v_receipt.branch_id
        AND product_id = v_item.product_id
        AND variant_id IS NULL
      FOR UPDATE;
    END IF;

    IF v_branch_inventory_id IS NULL THEN
      RAISE EXCEPTION 'could not resolve branch_inventory entry for receipt item %', v_item.id;
    END IF;

    v_new_stock := COALESCE(v_previous_stock, 0) + v_item.quantity_received;
    v_effective_previous_qty := GREATEST(COALESCE(v_previous_stock, 0), 0);

    IF (v_effective_previous_qty + v_item.quantity_received) > 0 THEN
      v_new_avg_cost := ROUND((
        (v_effective_previous_qty * COALESCE(v_previous_avg_cost, 0))
        + (v_item.quantity_received::NUMERIC(14,4) * COALESCE(v_item.unit_cost, 0))
      ) / (v_effective_previous_qty + v_item.quantity_received), 4);
    ELSE
      v_new_avg_cost := COALESCE(v_item.unit_cost, COALESCE(v_previous_avg_cost, 0));
    END IF;

    UPDATE branch_inventory
    SET stock = v_new_stock,
        avg_unit_cost = COALESCE(v_new_avg_cost, avg_unit_cost),
        last_purchase_unit_cost = COALESCE(v_item.unit_cost, last_purchase_unit_cost),
        cost_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = v_branch_inventory_id;

    IF v_has_supplier_column THEN
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
        supplier_id,
        created_at
      )
      VALUES (
        v_branch_inventory_id,
        'receipt',
        v_item.quantity_received,
        COALESCE(v_previous_stock, 0),
        v_new_stock,
        p_goods_receipt_id,
        'goods_receipt',
        COALESCE(v_item.notes, v_receipt.notes),
        auth.uid(),
        v_receipt.supplier_id,
        NOW()
      );
    ELSE
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
        'receipt',
        v_item.quantity_received,
        COALESCE(v_previous_stock, 0),
        v_new_stock,
        p_goods_receipt_id,
        'goods_receipt',
        COALESCE(v_item.notes, v_receipt.notes),
        auth.uid(),
        NOW()
      );
    END IF;
  END LOOP;

  UPDATE goods_receipts
  SET status = 'posted',
      posted_by = auth.uid(),
      posted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_goods_receipt_id;

  IF v_receipt.purchase_order_id IS NOT NULL THEN
    UPDATE purchase_order_items poi
    SET quantity_received = COALESCE(src.qty_received, 0)
    FROM (
      SELECT
        gri.purchase_order_item_id,
        SUM(gri.quantity_received)::INTEGER AS qty_received
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
      WHERE gr.status = 'posted'
        AND gri.purchase_order_item_id IS NOT NULL
      GROUP BY gri.purchase_order_item_id
    ) src
    WHERE poi.id = src.purchase_order_item_id
      AND poi.purchase_order_id = v_receipt.purchase_order_id;

    UPDATE purchase_orders po
    SET
      status = CASE
        WHEN EXISTS (
          SELECT 1 FROM purchase_order_items poi
          WHERE poi.purchase_order_id = po.id
            AND poi.quantity_received < poi.quantity_ordered
        ) THEN 'partially_received'
        ELSE 'received'
      END,
      received_at = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM purchase_order_items poi
          WHERE poi.purchase_order_id = po.id
            AND poi.quantity_received < poi.quantity_ordered
        ) THEN NOW()
        ELSE po.received_at
      END,
      updated_at = NOW()
    WHERE po.id = v_receipt.purchase_order_id
      AND po.status <> 'cancelled';
  END IF;

  RETURN p_goods_receipt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_goods_receipt(UUID) TO authenticated;

-- =============================================================================
-- 4) OPTIONAL BACKFILL: populate snapshot for existing order_items
-- =============================================================================

UPDATE order_items oi
SET price = oi.price
WHERE oi.cost_at_sale IS NULL;

COMMENT ON COLUMN branch_inventory.avg_unit_cost IS 'Costo promedio ponderado vigente por sucursal/producto o variante.';
COMMENT ON COLUMN branch_inventory.last_purchase_unit_cost IS 'Último costo unitario de compra recibido.';
COMMENT ON COLUMN order_items.cost_at_sale IS 'Snapshot de costo unitario aplicado al momento de la venta.';
COMMENT ON COLUMN order_items.margin_at_sale IS 'Margen bruto absoluto calculado al momento de la venta.';
COMMENT ON COLUMN order_items.margin_percentage_at_sale IS 'Margen bruto porcentual calculado al momento de la venta.';
COMMENT ON COLUMN order_items.cost_source IS 'Origen del costo aplicado (ej. weighted_average_branch, inventory_cost_missing).';
