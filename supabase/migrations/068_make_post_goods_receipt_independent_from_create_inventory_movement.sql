-- Make post_goods_receipt independent from create_inventory_movement signature differences
-- This avoids runtime failures caused by overloaded/missing create_inventory_movement variants.

CREATE OR REPLACE FUNCTION post_goods_receipt(p_goods_receipt_id UUID)
RETURNS UUID AS $$
DECLARE
  v_receipt goods_receipts%ROWTYPE;
  v_item RECORD;
  v_branch_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
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
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
      VALUES (v_receipt.branch_id, NULL, v_item.variant_id, 0, 0, 10)
      ON CONFLICT (branch_id, variant_id) WHERE variant_id IS NOT NULL DO NOTHING;

      SELECT id, stock INTO v_branch_inventory_id, v_previous_stock
      FROM branch_inventory
      WHERE branch_id = v_receipt.branch_id
        AND variant_id = v_item.variant_id
        AND product_id IS NULL
      FOR UPDATE;
    ELSE
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
      VALUES (v_receipt.branch_id, v_item.product_id, NULL, 0, 0, 10)
      ON CONFLICT (branch_id, product_id) WHERE product_id IS NOT NULL DO NOTHING;

      SELECT id, stock INTO v_branch_inventory_id, v_previous_stock
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

    UPDATE branch_inventory
    SET stock = v_new_stock,
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

COMMENT ON FUNCTION post_goods_receipt(UUID)
IS 'Postea recepcion sin depender de create_inventory_movement. Inserta inventory_movements directamente.';
