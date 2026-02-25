-- Phase 5: explicit order cancellation workflow (full return baseline)
-- Scope:
-- - Persist cancellation metadata in order_returns/order_return_items
-- - RPC to cancel order with reason and traceability
-- - Keep compatibility with existing stock restore trigger on orders.status = 'cancelled'

CREATE TABLE IF NOT EXISTS order_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_type VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (return_type IN ('full', 'partial')),
  status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'cancelled')),
  reason TEXT NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  refund_method VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_returns_org_created_at ON order_returns(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_returns_org_order ON order_returns(organization_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_org_status ON order_returns(organization_id, status);

CREATE TABLE IF NOT EXISTS order_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_return_id UUID NOT NULL REFERENCES order_returns(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_return_items_return_id ON order_return_items(order_return_id);
CREATE INDEX IF NOT EXISTS idx_order_return_items_org_product ON order_return_items(organization_id, product_id);

DROP TRIGGER IF EXISTS update_order_returns_updated_at ON order_returns;
CREATE TRIGGER update_order_returns_updated_at
  BEFORE UPDATE ON order_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION create_full_order_cancellation(
  p_order_id UUID,
  p_reason TEXT,
  p_refund_method VARCHAR(50) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_return_id UUID;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id es requerido';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;

  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_member(v_order.organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'La orden % ya está cancelada', p_order_id;
  END IF;

  INSERT INTO order_returns (
    organization_id,
    order_id,
    return_type,
    status,
    reason,
    refund_amount,
    refund_method,
    notes,
    created_by,
    posted_by,
    posted_at
  )
  VALUES (
    v_order.organization_id,
    v_order.id,
    'full',
    'posted',
    TRIM(p_reason),
    COALESCE(v_order.total, 0),
    p_refund_method,
    p_notes,
    auth.uid(),
    auth.uid(),
    NOW()
  )
  RETURNING id INTO v_return_id;

  INSERT INTO order_return_items (
    organization_id,
    order_return_id,
    order_item_id,
    product_id,
    variant_id,
    quantity,
    unit_price,
    line_total
  )
  SELECT
    v_order.organization_id,
    v_return_id,
    oi.id,
    oi.product_id,
    oi.variant_id,
    oi.quantity,
    oi.price,
    (oi.quantity * oi.price)::NUMERIC(12,2)
  FROM order_items oi
  WHERE oi.order_id = v_order.id;

  -- Existing trigger restore_branch_inventory will restore stock and create return inventory movements
  UPDATE orders
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = v_order.id;

  PERFORM create_audit_log(
    'orders',
    v_order.id,
    'UPDATE',
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled', 'reason', TRIM(p_reason), 'order_return_id', v_return_id),
    'Anulación completa de orden con devolución total',
    v_order.organization_id
  );

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_full_order_cancellation(UUID, TEXT, VARCHAR, TEXT) TO authenticated;

ALTER TABLE order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order returns select" ON order_returns;
CREATE POLICY "Order returns select"
  ON order_returns FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Order returns mutate" ON order_returns;
CREATE POLICY "Order returns mutate"
  ON order_returns FOR ALL
  USING (public.is_org_admin_or_manager(organization_id))
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

DROP POLICY IF EXISTS "Order return items select" ON order_return_items;
CREATE POLICY "Order return items select"
  ON order_return_items FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Order return items mutate" ON order_return_items;
CREATE POLICY "Order return items mutate"
  ON order_return_items FOR ALL
  USING (public.is_org_admin_or_manager(organization_id))
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

COMMENT ON TABLE order_returns IS 'Registro de anulaciones/devoluciones de ventas (baseline Fase 5).';
COMMENT ON TABLE order_return_items IS 'Detalle de ítems incluidos en una devolución/anulación de venta.';
COMMENT ON FUNCTION create_full_order_cancellation(UUID, TEXT, VARCHAR, TEXT)
IS 'Anula una orden completa con motivo, registra order_return y dispara restauración de stock vía trigger de orders.';
