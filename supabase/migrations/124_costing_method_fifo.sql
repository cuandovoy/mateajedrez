-- Migration: 124_costing_method_fifo.sql
-- Agrega soporte para método de costeo FIFO por organización.
-- Por defecto: Costo Promedio Ponderado (weighted_average) — sin cambios en comportamiento existente.
-- FIFO activable via organizations.settings->>'costing_method' = 'fifo'.
--
-- Cambios:
--   1) Índices en inventory_lots para queries FIFO eficientes
--   2) trg_set_order_item_cost_snapshot: soporta FIFO (BEFORE INSERT, solo lee lotes)
--   3) trg_consume_inventory_lots_fifo: decrementa lotes al insertar order_items (AFTER INSERT)
--   4) post_goods_receipt: crea registros en inventory_lots cuando costing_method = 'fifo'
--   5) get_inventory_valuation_report: RPC para tabla de valuación de inventario

-- =============================================================================
-- 1) ÍNDICES PARA QUERIES FIFO
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo_product
  ON public.inventory_lots (branch_id, product_id, received_at ASC)
  WHERE status = 'active' AND product_id IS NOT NULL AND quantity_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo_variant
  ON public.inventory_lots (branch_id, variant_id, received_at ASC)
  WHERE status = 'active' AND variant_id IS NOT NULL AND quantity_remaining > 0;

-- =============================================================================
-- 2) SNAPSHOT DE COSTO EN VENTA (BEFORE INSERT en order_items)
-- Calcula cost_at_sale usando FIFO (lotes) o WACC según configuración de la org.
-- No modifica lotes — solo lectura para el snapshot.
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_set_order_item_cost_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_branch_id         UUID;
  v_org_id            UUID;
  v_costing_method    TEXT;
  v_avg_unit_cost     NUMERIC(12,4);
  v_revenue           NUMERIC(14,4);
  v_total_cost        NUMERIC(14,4);
  v_qty_needed        NUMERIC(14,4);
  v_lot               RECORD;
  v_weighted_cost     NUMERIC(14,4);
  v_qty_from_lot      NUMERIC(14,4);
BEGIN
  SELECT o.branch_id, b.organization_id
  INTO v_branch_id, v_org_id
  FROM orders o
  JOIN branches b ON b.id = o.branch_id
  WHERE o.id = NEW.order_id;

  IF v_branch_id IS NULL THEN
    NEW.cost_at_sale              := NULL;
    NEW.margin_at_sale            := NULL;
    NEW.margin_percentage_at_sale := NULL;
    NEW.cost_source               := 'branch_missing';
    RETURN NEW;
  END IF;

  SELECT COALESCE(settings->>'costing_method', 'weighted_average')
  INTO v_costing_method
  FROM organizations
  WHERE id = v_org_id;

  -- ---------------------------------------------------------------
  -- FIFO: costo a partir de lotes, en orden de entrada (más antiguo primero)
  -- ---------------------------------------------------------------
  IF v_costing_method = 'fifo' THEN
    v_qty_needed    := COALESCE(NEW.quantity, 0)::NUMERIC(14,4);
    v_weighted_cost := 0;

    FOR v_lot IN
      SELECT quantity_remaining, unit_cost
      FROM inventory_lots
      WHERE branch_id = v_branch_id
        AND status = 'active'
        AND quantity_remaining > 0
        AND (
          (NEW.variant_id IS NOT NULL AND variant_id = NEW.variant_id)
          OR
          (NEW.variant_id IS NULL AND product_id = NEW.product_id AND variant_id IS NULL)
        )
      ORDER BY received_at ASC
    LOOP
      EXIT WHEN v_qty_needed <= 0;
      v_qty_from_lot  := LEAST(v_qty_needed, v_lot.quantity_remaining::NUMERIC(14,4));
      v_weighted_cost := v_weighted_cost + (v_qty_from_lot * COALESCE(v_lot.unit_cost, 0));
      v_qty_needed    := v_qty_needed - v_qty_from_lot;
    END LOOP;

    -- Si no hay lotes suficientes, el resto usa avg_unit_cost como fallback
    IF v_qty_needed > 0 THEN
      IF NEW.variant_id IS NOT NULL THEN
        SELECT bi.avg_unit_cost INTO v_avg_unit_cost
        FROM branch_inventory bi
        WHERE bi.branch_id = v_branch_id
          AND bi.variant_id = NEW.variant_id
          AND bi.product_id IS NULL
        LIMIT 1;
      ELSE
        SELECT bi.avg_unit_cost INTO v_avg_unit_cost
        FROM branch_inventory bi
        WHERE bi.branch_id = v_branch_id
          AND bi.product_id = NEW.product_id
          AND bi.variant_id IS NULL
        LIMIT 1;
      END IF;
      v_weighted_cost := v_weighted_cost + (v_qty_needed * COALESCE(v_avg_unit_cost, 0));
    END IF;

    v_avg_unit_cost := CASE
      WHEN COALESCE(NEW.quantity, 0) > 0
        THEN ROUND(v_weighted_cost / NEW.quantity::NUMERIC(14,4), 4)
      ELSE 0
    END;

    IF COALESCE(v_avg_unit_cost, 0) = 0 THEN
      NEW.cost_at_sale              := NULL;
      NEW.margin_at_sale            := NULL;
      NEW.margin_percentage_at_sale := NULL;
      NEW.cost_source               := 'inventory_cost_missing';
      RETURN NEW;
    END IF;

    v_revenue    := COALESCE(NEW.price, 0)::NUMERIC(14,4) * COALESCE(NEW.quantity, 0)::NUMERIC(14,4);
    v_total_cost := v_avg_unit_cost * COALESCE(NEW.quantity, 0)::NUMERIC(14,4);

    NEW.cost_at_sale              := v_avg_unit_cost;
    NEW.margin_at_sale            := ROUND(v_revenue - v_total_cost, 4);
    NEW.margin_percentage_at_sale := CASE
      WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_total_cost) / v_revenue) * 100, 4)
      ELSE NULL
    END;
    NEW.cost_source := 'fifo_branch';
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------
  -- WACC (default): comportamiento original
  -- ---------------------------------------------------------------
  IF NEW.variant_id IS NOT NULL THEN
    SELECT bi.avg_unit_cost INTO v_avg_unit_cost
    FROM branch_inventory bi
    WHERE bi.branch_id = v_branch_id
      AND bi.variant_id = NEW.variant_id
      AND bi.product_id IS NULL
    LIMIT 1;
  ELSE
    SELECT bi.avg_unit_cost INTO v_avg_unit_cost
    FROM branch_inventory bi
    WHERE bi.branch_id = v_branch_id
      AND bi.product_id = NEW.product_id
      AND bi.variant_id IS NULL
    LIMIT 1;
  END IF;

  IF v_avg_unit_cost IS NULL THEN
    NEW.cost_at_sale              := NULL;
    NEW.margin_at_sale            := NULL;
    NEW.margin_percentage_at_sale := NULL;
    NEW.cost_source               := 'inventory_cost_missing';
    RETURN NEW;
  END IF;

  v_revenue    := COALESCE(NEW.price, 0)::NUMERIC(14,4) * COALESCE(NEW.quantity, 0)::NUMERIC(14,4);
  v_total_cost := v_avg_unit_cost * COALESCE(NEW.quantity, 0)::NUMERIC(14,4);

  NEW.cost_at_sale              := v_avg_unit_cost;
  NEW.margin_at_sale            := ROUND(v_revenue - v_total_cost, 4);
  NEW.margin_percentage_at_sale := CASE
    WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_total_cost) / v_revenue) * 100, 4)
    ELSE NULL
  END;
  NEW.cost_source := 'weighted_average_branch';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe (migration 069). La función se reemplazó con CREATE OR REPLACE.

-- =============================================================================
-- 3) CONSUMO DE LOTES FIFO (AFTER INSERT en order_items)
-- Decrementa quantity_remaining en los lotes más antiguos al registrar una venta.
-- Solo actúa cuando costing_method = 'fifo'.
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_consume_inventory_lots_fifo()
RETURNS TRIGGER AS $$
DECLARE
  v_branch_id      UUID;
  v_org_id         UUID;
  v_costing_method TEXT;
  v_qty_to_consume INT;
  v_lot            RECORD;
  v_consume        INT;
BEGIN
  SELECT o.branch_id, b.organization_id
  INTO v_branch_id, v_org_id
  FROM orders o
  JOIN branches b ON b.id = o.branch_id
  WHERE o.id = NEW.order_id;

  IF v_branch_id IS NULL OR v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(settings->>'costing_method', 'weighted_average')
  INTO v_costing_method
  FROM organizations
  WHERE id = v_org_id;

  IF v_costing_method <> 'fifo' THEN
    RETURN NEW;
  END IF;

  v_qty_to_consume := COALESCE(NEW.quantity, 0);

  FOR v_lot IN
    SELECT id, quantity_remaining
    FROM inventory_lots
    WHERE branch_id = v_branch_id
      AND status = 'active'
      AND quantity_remaining > 0
      AND (
        (NEW.variant_id IS NOT NULL AND variant_id = NEW.variant_id)
        OR
        (NEW.variant_id IS NULL AND product_id = NEW.product_id AND variant_id IS NULL)
      )
    ORDER BY received_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_qty_to_consume <= 0;
    v_consume := LEAST(v_qty_to_consume, v_lot.quantity_remaining);

    UPDATE inventory_lots
    SET
      quantity_remaining = quantity_remaining - v_consume,
      status             = CASE WHEN (quantity_remaining - v_consume) <= 0 THEN 'exhausted' ELSE 'active' END,
      updated_at         = now()
    WHERE id = v_lot.id;

    v_qty_to_consume := v_qty_to_consume - v_consume;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consume_lots_fifo_order_item ON public.order_items;
CREATE TRIGGER trg_consume_lots_fifo_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION trg_consume_inventory_lots_fifo();

-- =============================================================================
-- 4) post_goods_receipt: crea lotes al recibir mercadería (FIFO)
-- Reemplaza la función completa para agregar creación de lotes.
-- El cálculo de WACC y los movimientos de inventario no cambian.
-- =============================================================================

CREATE OR REPLACE FUNCTION post_goods_receipt(p_goods_receipt_id UUID)
RETURNS UUID AS $$
DECLARE
  v_receipt                goods_receipts%ROWTYPE;
  v_item                   RECORD;
  v_branch_inventory_id    UUID;
  v_previous_stock         INTEGER;
  v_new_stock              INTEGER;
  v_previous_avg_cost      NUMERIC(12,4);
  v_effective_previous_qty NUMERIC(14,4);
  v_new_avg_cost           NUMERIC(12,4);
  v_has_supplier_column    BOOLEAN;
  v_org_id                 UUID;
  v_costing_method         TEXT;
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
      AND table_name   = 'inventory_movements'
      AND column_name  = 'supplier_id'
  )
  INTO v_has_supplier_column;

  SELECT b.organization_id INTO v_org_id
  FROM branches b WHERE b.id = v_receipt.branch_id;

  SELECT COALESCE(settings->>'costing_method', 'weighted_average')
  INTO v_costing_method
  FROM organizations WHERE id = v_org_id;

  FOR v_item IN
    SELECT * FROM goods_receipt_items WHERE goods_receipt_id = p_goods_receipt_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold, avg_unit_cost)
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
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold, avg_unit_cost)
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

    v_new_stock              := COALESCE(v_previous_stock, 0) + v_item.quantity_received;
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
    SET
      stock                   = v_new_stock,
      avg_unit_cost           = COALESCE(v_new_avg_cost, avg_unit_cost),
      last_purchase_unit_cost = COALESCE(v_item.unit_cost, last_purchase_unit_cost),
      cost_updated_at         = NOW(),
      updated_at              = NOW()
    WHERE id = v_branch_inventory_id;

    -- FIFO: crear lote por cada ítem recibido
    IF v_costing_method = 'fifo' AND v_item.unit_cost IS NOT NULL THEN
      INSERT INTO inventory_lots (
        organization_id,
        branch_id,
        product_id,
        variant_id,
        received_at,
        quantity_received,
        quantity_remaining,
        unit_cost,
        supplier_id,
        reference_document,
        created_by
      ) VALUES (
        v_org_id,
        v_receipt.branch_id,
        CASE WHEN v_item.variant_id IS NULL THEN v_item.product_id ELSE NULL END,
        v_item.variant_id,
        NOW(),
        v_item.quantity_received,
        v_item.quantity_received,
        v_item.unit_cost,
        v_receipt.supplier_id,
        p_goods_receipt_id::TEXT,
        auth.uid()
      );
    END IF;

    IF v_has_supplier_column THEN
      INSERT INTO inventory_movements (
        branch_inventory_id, movement_type, quantity, previous_stock, new_stock,
        reference_id, reference_type, notes, created_by, supplier_id, created_at
      ) VALUES (
        v_branch_inventory_id, 'receipt', v_item.quantity_received,
        COALESCE(v_previous_stock, 0), v_new_stock,
        p_goods_receipt_id, 'goods_receipt',
        COALESCE(v_item.notes, v_receipt.notes),
        auth.uid(), v_receipt.supplier_id, NOW()
      );
    ELSE
      INSERT INTO inventory_movements (
        branch_inventory_id, movement_type, quantity, previous_stock, new_stock,
        reference_id, reference_type, notes, created_by, created_at
      ) VALUES (
        v_branch_inventory_id, 'receipt', v_item.quantity_received,
        COALESCE(v_previous_stock, 0), v_new_stock,
        p_goods_receipt_id, 'goods_receipt',
        COALESCE(v_item.notes, v_receipt.notes),
        auth.uid(), NOW()
      );
    END IF;
  END LOOP;

  UPDATE goods_receipts
  SET status    = 'posted',
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
-- 5) RPC: reporte de valuación de inventario por producto y sucursal
-- =============================================================================

CREATE OR REPLACE FUNCTION get_inventory_valuation_report(
  p_organization_id UUID,
  p_branch_id       UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  sku           TEXT,
  variant_id    UUID,
  variant_name  TEXT,
  branch_id     UUID,
  branch_name   TEXT,
  stock         INTEGER,
  avg_unit_cost NUMERIC,
  total_value   NUMERIC
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    COALESCE(p.id,   pp.id)   AS product_id,
    COALESCE(p.name, pp.name) AS product_name,
    COALESCE(p.sku,  pp.sku)  AS sku,
    bi.variant_id,
    pv.name                   AS variant_name,
    br.id                     AS branch_id,
    br.name                   AS branch_name,
    bi.stock,
    bi.avg_unit_cost,
    ROUND((bi.stock::NUMERIC * bi.avg_unit_cost), 2) AS total_value
  FROM branch_inventory bi
  JOIN branches br ON br.id = bi.branch_id
  LEFT JOIN products         p  ON p.id  = bi.product_id
  LEFT JOIN product_variants pv ON pv.id = bi.variant_id
  LEFT JOIN products         pp ON pp.id = pv.product_id
  WHERE br.organization_id = p_organization_id
    AND bi.stock > 0
    AND bi.avg_unit_cost > 0
    AND (p_branch_id IS NULL OR bi.branch_id = p_branch_id)
  ORDER BY (bi.stock::NUMERIC * bi.avg_unit_cost) DESC;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_valuation_report(UUID, UUID) TO authenticated;
