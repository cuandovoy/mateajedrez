-- Phase 6: Sales discounts engine (manual + rule catalog)
-- Includes:
-- - sales_discount_rules table
-- - order/order_item discount fields
-- - consistency constraints
-- - RPCs to apply/remove discounts
-- - order totals recalculation with payment safety

-- -----------------------------------------------------------------------------
-- 1) Catalog: rules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('order', 'item')),
  kind TEXT NOT NULL CHECK (kind IN ('percentage', 'fixed_amount', 'price_override')),
  value NUMERIC(12,2) NOT NULL CHECK (value > 0),
  min_order_total NUMERIC(12,2) NULL CHECK (min_order_total IS NULL OR min_order_total >= 0),
  max_discount_amount NUMERIC(12,2) NULL CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_discount_rules_date_window_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_sales_discount_rules_org_active
  ON public.sales_discount_rules (organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sales_discount_rules_org_dates
  ON public.sales_discount_rules (organization_id, starts_at, ends_at);

CREATE TRIGGER update_sales_discount_rules_updated_at
  BEFORE UPDATE ON public.sales_discount_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales_discount_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales discount rules select" ON public.sales_discount_rules;
CREATE POLICY "Sales discount rules select"
  ON public.sales_discount_rules FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Sales discount rules mutate" ON public.sales_discount_rules;
CREATE POLICY "Sales discount rules mutate"
  ON public.sales_discount_rules FOR ALL
  USING (public.is_org_admin_or_manager(organization_id))
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

-- -----------------------------------------------------------------------------
-- 2) Orders/Items schema
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal_before_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_metadata JSONB NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_metadata JSONB NULL;

UPDATE public.order_items
SET base_unit_price = price
WHERE base_unit_price IS NULL;

ALTER TABLE public.order_items
  ALTER COLUMN base_unit_price SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS check_orders_discount_total_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT check_orders_discount_total_valid
  CHECK (discount_total >= 0 AND discount_total <= subtotal_before_discount);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS check_order_items_discount_amount_valid;
ALTER TABLE public.order_items
  ADD CONSTRAINT check_order_items_discount_amount_valid
  CHECK (discount_amount >= 0 AND discount_amount <= (base_unit_price * quantity));

CREATE INDEX IF NOT EXISTS idx_orders_org_discount_total
  ON public.orders (organization_id, discount_total);

CREATE INDEX IF NOT EXISTS idx_order_items_order_discount
  ON public.order_items (order_id, discount_amount);

-- -----------------------------------------------------------------------------
-- 3) Helpers and recalculation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_discount_amount(
  p_kind TEXT,
  p_value NUMERIC,
  p_base_amount NUMERIC,
  p_quantity INTEGER DEFAULT 1
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_discount NUMERIC := 0;
BEGIN
  IF p_base_amount <= 0 OR p_value <= 0 THEN
    RETURN 0;
  END IF;

  CASE p_kind
    WHEN 'percentage' THEN
      v_discount := p_base_amount * (p_value / 100.0);
    WHEN 'fixed_amount' THEN
      v_discount := p_value;
    WHEN 'price_override' THEN
      v_discount := p_base_amount - (p_value * GREATEST(p_quantity, 1));
    ELSE
      RAISE EXCEPTION 'Tipo de descuento inválido: %', p_kind;
  END CASE;

  IF v_discount < 0 THEN
    v_discount := 0;
  END IF;

  IF v_discount > p_base_amount THEN
    v_discount := p_base_amount;
  END IF;

  RETURN ROUND(v_discount, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_order_totals(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_subtotal_before NUMERIC(12,2) := 0;
  v_item_discount_total NUMERIC(12,2) := 0;
  v_order_discount NUMERIC(12,2) := 0;
  v_order_discount_kind TEXT;
  v_order_discount_value NUMERIC(12,2);
  v_order_discount_max NUMERIC(12,2);
  v_subtotal_after_items NUMERIC(12,2);
  v_final_total NUMERIC(12,2);
  v_tax_total NUMERIC(12,2) := 0;
  v_total_paid NUMERIC(12,2) := 0;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  SELECT
    COALESCE(SUM(oi.base_unit_price * oi.quantity), 0)::NUMERIC(12,2),
    COALESCE(SUM(oi.discount_amount), 0)::NUMERIC(12,2)
  INTO v_subtotal_before, v_item_discount_total
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  v_subtotal_after_items := GREATEST(v_subtotal_before - v_item_discount_total, 0);

  IF v_order.discount_metadata IS NOT NULL THEN
    v_order_discount_kind := v_order.discount_metadata->>'kind';
    v_order_discount_value := COALESCE((v_order.discount_metadata->>'value')::NUMERIC, 0);
    v_order_discount_max := NULLIF(COALESCE(v_order.discount_metadata->>'max_discount_amount', ''), '')::NUMERIC;

    v_order_discount := public.calculate_discount_amount(
      v_order_discount_kind,
      v_order_discount_value,
      v_subtotal_after_items,
      1
    );

    IF v_order_discount_max IS NOT NULL AND v_order_discount > v_order_discount_max THEN
      v_order_discount := v_order_discount_max;
    END IF;

    IF v_order_discount > v_subtotal_after_items THEN
      v_order_discount := v_subtotal_after_items;
    END IF;
  END IF;

  v_tax_total := COALESCE(v_order.tax_total, 0);
  v_final_total := GREATEST(v_subtotal_after_items - v_order_discount, 0) + v_tax_total;

  SELECT COALESCE(SUM(op.amount), 0)::NUMERIC(12,2)
  INTO v_total_paid
  FROM public.order_payments op
  WHERE op.order_id = p_order_id;

  IF v_final_total < v_total_paid THEN
    RAISE EXCEPTION 'El total final (%) no puede ser menor al total ya cobrado (%)', v_final_total, v_total_paid;
  END IF;

  UPDATE public.orders
  SET
    subtotal_before_discount = v_subtotal_before,
    discount_total = v_item_discount_total + v_order_discount,
    total = v_final_total,
    discount_metadata = CASE
      WHEN discount_metadata IS NULL THEN NULL
      ELSE jsonb_set(discount_metadata, '{applied_amount}', to_jsonb(v_order_discount), true)
    END,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'subtotal_before_discount', v_subtotal_before,
    'item_discount_total', v_item_discount_total,
    'order_discount_total', v_order_discount,
    'discount_total', v_item_discount_total + v_order_discount,
    'tax_total', v_tax_total,
    'final_total', v_final_total,
    'total_paid', v_total_paid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_item_discount_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.base_unit_price IS NULL THEN
    NEW.base_unit_price := NEW.price;
  END IF;

  IF NEW.discount_amount IS NULL THEN
    NEW.discount_amount := 0;
  END IF;

  IF NEW.discount_amount < 0 THEN
    NEW.discount_amount := 0;
  END IF;

  IF NEW.discount_amount > (NEW.base_unit_price * NEW.quantity) THEN
    NEW.discount_amount := NEW.base_unit_price * NEW.quantity;
  END IF;

  NEW.price := GREATEST((NEW.base_unit_price * NEW.quantity - NEW.discount_amount) / NEW.quantity, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_item_discount_defaults ON public.order_items;
CREATE TRIGGER trg_sync_order_item_discount_defaults
BEFORE INSERT OR UPDATE OF base_unit_price, discount_amount, quantity
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_item_discount_defaults();

CREATE OR REPLACE FUNCTION public.trg_recalculate_order_totals_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_order_totals(CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_order_totals_from_items ON public.order_items;
CREATE TRIGGER trg_recalculate_order_totals_from_items
AFTER INSERT OR UPDATE OF quantity, price, base_unit_price, discount_amount OR DELETE
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalculate_order_totals_from_items();

-- -----------------------------------------------------------------------------
-- 4) Discount RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_active_sales_discount_rules(
  p_organization_id UUID,
  p_scope TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  scope TEXT,
  kind TEXT,
  value NUMERIC,
  min_order_total NUMERIC,
  max_discount_amount NUMERIC,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id es requerido';
  END IF;

  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.scope,
    r.kind,
    r.value,
    r.min_order_total,
    r.max_discount_amount,
    r.starts_at,
    r.ends_at,
    r.is_active
  FROM public.sales_discount_rules r
  WHERE r.organization_id = p_organization_id
    AND r.is_active = TRUE
    AND (p_scope IS NULL OR r.scope = p_scope)
    AND (r.starts_at IS NULL OR r.starts_at <= NOW())
    AND (r.ends_at IS NULL OR r.ends_at >= NOW())
  ORDER BY r.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_discount(
  p_order_id UUID,
  p_discount JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_rule RECORD;
  v_kind TEXT;
  v_value NUMERIC;
  v_min_order_total NUMERIC;
  v_max_discount_amount NUMERIC;
  v_reason TEXT;
  v_payload JSONB;
  v_recalc JSONB;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id es requerido';
  END IF;

  IF p_discount IS NULL THEN
    RAISE EXCEPTION 'discount es requerido';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_admin_or_manager(v_order.organization_id) THEN
    RAISE EXCEPTION 'Solo admin/manager puede aplicar descuentos';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede aplicar descuento en una orden cancelada';
  END IF;

  IF p_discount ? 'rule_id' THEN
    SELECT * INTO v_rule
    FROM public.sales_discount_rules r
    WHERE r.id = (p_discount->>'rule_id')::UUID
      AND r.organization_id = v_order.organization_id
      AND r.scope = 'order'
      AND r.is_active = TRUE
      AND (r.starts_at IS NULL OR r.starts_at <= NOW())
      AND (r.ends_at IS NULL OR r.ends_at >= NOW());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Regla de descuento inválida o inactiva';
    END IF;

    v_kind := v_rule.kind;
    v_value := v_rule.value;
    v_min_order_total := v_rule.min_order_total;
    v_max_discount_amount := v_rule.max_discount_amount;
  ELSE
    v_kind := p_discount->>'kind';
    v_value := COALESCE((p_discount->>'value')::NUMERIC, 0);
    v_min_order_total := NULLIF(COALESCE(p_discount->>'min_order_total', ''), '')::NUMERIC;
    v_max_discount_amount := NULLIF(COALESCE(p_discount->>'max_discount_amount', ''), '')::NUMERIC;
  END IF;

  IF v_kind NOT IN ('percentage', 'fixed_amount', 'price_override') THEN
    RAISE EXCEPTION 'Tipo de descuento inválido';
  END IF;

  IF v_value <= 0 THEN
    RAISE EXCEPTION 'Valor de descuento inválido';
  END IF;

  IF v_min_order_total IS NOT NULL AND COALESCE(v_order.subtotal_before_discount, v_order.total) < v_min_order_total THEN
    RAISE EXCEPTION 'La orden no cumple el monto mínimo para este descuento';
  END IF;

  v_reason := NULLIF(TRIM(COALESCE(p_discount->>'reason', '')), '');

  v_payload := jsonb_build_object(
    'source', CASE WHEN p_discount ? 'rule_id' THEN 'rule' ELSE 'manual' END,
    'rule_id', CASE WHEN p_discount ? 'rule_id' THEN (p_discount->>'rule_id')::UUID ELSE NULL END,
    'kind', v_kind,
    'value', v_value,
    'min_order_total', v_min_order_total,
    'max_discount_amount', v_max_discount_amount,
    'reason', v_reason,
    'applied_by', auth.uid(),
    'applied_at', NOW()
  );

  UPDATE public.orders
  SET discount_metadata = v_payload,
      updated_at = NOW()
  WHERE id = p_order_id;

  v_recalc := public.recalculate_order_totals(p_order_id);

  PERFORM public.create_audit_log(
    'orders',
    p_order_id,
    'ORDER_DISCOUNT_APPLIED',
    NULL,
    jsonb_build_object('discount', v_payload, 'totals', v_recalc),
    'Descuento aplicado a orden',
    v_order.organization_id
  );

  RETURN jsonb_build_object('ok', TRUE, 'discount', v_payload, 'totals', v_recalc);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_order_discount(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_old_discount JSONB;
  v_recalc JSONB;
BEGIN
  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_admin_or_manager(v_order.organization_id) THEN
    RAISE EXCEPTION 'Solo admin/manager puede quitar descuentos';
  END IF;

  v_old_discount := v_order.discount_metadata;

  UPDATE public.orders
  SET discount_metadata = NULL,
      updated_at = NOW()
  WHERE id = p_order_id;

  v_recalc := public.recalculate_order_totals(p_order_id);

  PERFORM public.create_audit_log(
    'orders',
    p_order_id,
    'ORDER_DISCOUNT_REMOVED',
    jsonb_build_object('discount', v_old_discount),
    jsonb_build_object('totals', v_recalc),
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Descuento removido de orden'),
    v_order.organization_id
  );

  RETURN jsonb_build_object('ok', TRUE, 'totals', v_recalc);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_item_discount(
  p_order_id UUID,
  p_order_item_id UUID,
  p_discount JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_rule RECORD;
  v_kind TEXT;
  v_value NUMERIC;
  v_discount_amount NUMERIC;
  v_line_base NUMERIC;
  v_min_order_total NUMERIC;
  v_max_discount_amount NUMERIC;
  v_reason TEXT;
  v_payload JSONB;
  v_recalc JSONB;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL THEN
    RAISE EXCEPTION 'order_id y order_item_id son requeridos';
  END IF;

  IF p_discount IS NULL THEN
    RAISE EXCEPTION 'discount es requerido';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_admin_or_manager(v_order.organization_id) THEN
    RAISE EXCEPTION 'Solo admin/manager puede aplicar descuentos';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede aplicar descuento en una orden cancelada';
  END IF;

  SELECT * INTO v_item
  FROM public.order_items oi
  WHERE oi.id = p_order_item_id
    AND oi.order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem de orden no encontrado';
  END IF;

  IF p_discount ? 'rule_id' THEN
    SELECT * INTO v_rule
    FROM public.sales_discount_rules r
    WHERE r.id = (p_discount->>'rule_id')::UUID
      AND r.organization_id = v_order.organization_id
      AND r.scope = 'item'
      AND r.is_active = TRUE
      AND (r.starts_at IS NULL OR r.starts_at <= NOW())
      AND (r.ends_at IS NULL OR r.ends_at >= NOW());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Regla de descuento inválida o inactiva';
    END IF;

    v_kind := v_rule.kind;
    v_value := v_rule.value;
    v_min_order_total := v_rule.min_order_total;
    v_max_discount_amount := v_rule.max_discount_amount;
  ELSE
    v_kind := p_discount->>'kind';
    v_value := COALESCE((p_discount->>'value')::NUMERIC, 0);
    v_min_order_total := NULLIF(COALESCE(p_discount->>'min_order_total', ''), '')::NUMERIC;
    v_max_discount_amount := NULLIF(COALESCE(p_discount->>'max_discount_amount', ''), '')::NUMERIC;
  END IF;

  IF v_kind NOT IN ('percentage', 'fixed_amount', 'price_override') THEN
    RAISE EXCEPTION 'Tipo de descuento inválido';
  END IF;

  IF v_value <= 0 THEN
    RAISE EXCEPTION 'Valor de descuento inválido';
  END IF;

  IF v_min_order_total IS NOT NULL AND COALESCE(v_order.subtotal_before_discount, v_order.total) < v_min_order_total THEN
    RAISE EXCEPTION 'La orden no cumple el monto mínimo para este descuento';
  END IF;

  v_line_base := (v_item.base_unit_price * v_item.quantity);
  v_discount_amount := public.calculate_discount_amount(v_kind, v_value, v_line_base, v_item.quantity);

  IF v_max_discount_amount IS NOT NULL AND v_discount_amount > v_max_discount_amount THEN
    v_discount_amount := v_max_discount_amount;
  END IF;

  IF v_discount_amount > v_line_base THEN
    v_discount_amount := v_line_base;
  END IF;

  v_reason := NULLIF(TRIM(COALESCE(p_discount->>'reason', '')), '');

  v_payload := jsonb_build_object(
    'source', CASE WHEN p_discount ? 'rule_id' THEN 'rule' ELSE 'manual' END,
    'rule_id', CASE WHEN p_discount ? 'rule_id' THEN (p_discount->>'rule_id')::UUID ELSE NULL END,
    'kind', v_kind,
    'value', v_value,
    'min_order_total', v_min_order_total,
    'max_discount_amount', v_max_discount_amount,
    'reason', v_reason,
    'applied_by', auth.uid(),
    'applied_at', NOW(),
    'applied_amount', v_discount_amount
  );

  UPDATE public.order_items
  SET
    discount_amount = v_discount_amount,
    discount_metadata = v_payload,
    price = GREATEST((v_line_base - v_discount_amount) / v_item.quantity, 0)
  WHERE id = p_order_item_id;

  v_recalc := public.recalculate_order_totals(p_order_id);

  PERFORM public.create_audit_log(
    'order_items',
    p_order_item_id,
    'ORDER_ITEM_DISCOUNT_APPLIED',
    NULL,
    jsonb_build_object('discount', v_payload, 'totals', v_recalc),
    'Descuento aplicado a item de orden',
    v_order.organization_id
  );

  RETURN jsonb_build_object('ok', TRUE, 'discount', v_payload, 'totals', v_recalc);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_order_item_discount(
  p_order_id UUID,
  p_order_item_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_old_discount JSONB;
  v_recalc JSONB;
BEGIN
  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  IF NOT public.is_org_admin_or_manager(v_order.organization_id) THEN
    RAISE EXCEPTION 'Solo admin/manager puede quitar descuentos';
  END IF;

  SELECT * INTO v_item
  FROM public.order_items oi
  WHERE oi.id = p_order_item_id
    AND oi.order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem de orden no encontrado';
  END IF;

  v_old_discount := v_item.discount_metadata;

  UPDATE public.order_items
  SET
    discount_amount = 0,
    discount_metadata = NULL,
    price = base_unit_price
  WHERE id = p_order_item_id;

  v_recalc := public.recalculate_order_totals(p_order_id);

  PERFORM public.create_audit_log(
    'order_items',
    p_order_item_id,
    'ORDER_ITEM_DISCOUNT_REMOVED',
    jsonb_build_object('discount', v_old_discount),
    jsonb_build_object('totals', v_recalc),
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Descuento removido de item de orden'),
    v_order.organization_id
  );

  RETURN jsonb_build_object('ok', TRUE, 'totals', v_recalc);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_active_sales_discount_rules(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_discount(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_order_discount(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_item_discount(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_order_item_discount(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_order_totals(UUID) TO authenticated;

COMMENT ON TABLE public.sales_discount_rules
IS 'Catálogo de reglas de descuentos comerciales por organización (scope item/order).';

COMMENT ON COLUMN public.orders.discount_metadata
IS 'Metadatos del descuento global aplicado a la orden.';

COMMENT ON COLUMN public.order_items.discount_metadata
IS 'Metadatos del descuento aplicado a la línea de venta.';
