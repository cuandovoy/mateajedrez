-- Configuración por organización para completar transferencias automáticamente
-- organizations.settings.inventory_transfer_completion_mode:
-- - 'manual' (default): crea transferencia pending y requiere confirmación
-- - 'automatic': completa la transferencia al crearla

CREATE OR REPLACE FUNCTION public.create_inventory_transfer(
  p_from_branch_id UUID,
  p_to_branch_id UUID,
  p_quantity INTEGER,
  p_product_id UUID,
  p_variant_id UUID,
  p_notes TEXT,
  p_transfer_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_user_id UUID;
  v_from_inventory_id UUID;
  v_previous_stock INTEGER;
  v_org_id UUID;
  v_to_org_id UUID;
  v_tier VARCHAR(50);
  v_settings JSONB;
  v_from_kind TEXT;
  v_to_kind TEXT;
  v_from_can_dispatch BOOLEAN;
  v_to_can_receive BOOLEAN;
  v_transfer_type TEXT;
  v_reference_type TEXT;
  v_allow_seller_to_seller BOOLEAN;
  v_transfer_completion_mode TEXT;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than 0';
  END IF;

  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same branch';
  END IF;

  IF (p_product_id IS NULL AND p_variant_id IS NULL) OR (p_product_id IS NOT NULL AND p_variant_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of product_id or variant_id must be provided';
  END IF;

  v_transfer_type := COALESCE(NULLIF(TRIM(p_transfer_type), ''), 'regular');
  IF v_transfer_type NOT IN ('regular', 'seller_withdrawal', 'seller_return', 'seller_handoff') THEN
    RAISE EXCEPTION 'Unsupported transfer type: %', v_transfer_type;
  END IF;

  SELECT
    b.organization_id,
    b.kind,
    COALESCE(b.can_dispatch, TRUE),
    o.subscription_tier,
    COALESCE(o.settings, '{}'::jsonb)
  INTO
    v_org_id,
    v_from_kind,
    v_from_can_dispatch,
    v_tier,
    v_settings
  FROM public.branches b
  JOIN public.organizations o ON o.id = b.organization_id
  WHERE b.id = p_from_branch_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Source branch not found';
  END IF;

  SELECT
    b.organization_id,
    b.kind,
    COALESCE(b.can_receive, TRUE)
  INTO
    v_to_org_id,
    v_to_kind,
    v_to_can_receive
  FROM public.branches b
  WHERE b.id = p_to_branch_id;

  IF v_to_org_id IS NULL THEN
    RAISE EXCEPTION 'Destination branch not found';
  END IF;

  IF v_to_org_id <> v_org_id THEN
    RAISE EXCEPTION 'Cannot transfer across organizations';
  END IF;

  -- Plan check: transferencias solo para Profesional
  IF v_tier = 'starter' THEN
    RAISE EXCEPTION 'Las transferencias internas están disponibles en el plan Profesional.';
  END IF;

  IF NOT v_from_can_dispatch THEN
    RAISE EXCEPTION 'Source branch is not allowed to dispatch inventory';
  END IF;

  IF NOT v_to_can_receive THEN
    RAISE EXCEPTION 'Destination branch is not allowed to receive inventory';
  END IF;

  -- Extra validation for consignment-like transfers
  IF v_transfer_type <> 'regular' THEN
    IF COALESCE((v_settings ->> 'consignment_enabled')::BOOLEAN, FALSE) = FALSE THEN
      RAISE EXCEPTION 'El módulo de consignación no está habilitado para esta organización.';
    END IF;

    v_allow_seller_to_seller := COALESCE((v_settings ->> 'consignment_allow_seller_to_seller')::BOOLEAN, FALSE);

    IF v_transfer_type = 'seller_withdrawal' AND NOT (v_from_kind IN ('store', 'warehouse') AND v_to_kind = 'seller') THEN
      RAISE EXCEPTION 'seller_withdrawal requires origin store/warehouse and destination seller';
    END IF;

    IF v_transfer_type = 'seller_return' AND NOT (v_from_kind = 'seller' AND v_to_kind IN ('store', 'warehouse')) THEN
      RAISE EXCEPTION 'seller_return requires origin seller and destination store/warehouse';
    END IF;

    IF v_transfer_type = 'seller_handoff' THEN
      IF NOT (v_from_kind = 'seller' AND v_to_kind = 'seller') THEN
        RAISE EXCEPTION 'seller_handoff requires origin seller and destination seller';
      END IF;
      IF NOT v_allow_seller_to_seller THEN
        RAISE EXCEPTION 'La organización no permite transferencias entre vendedoras.';
      END IF;
    END IF;
  END IF;

  v_transfer_completion_mode := COALESCE(NULLIF(TRIM(v_settings ->> 'inventory_transfer_completion_mode'), ''), 'manual');
  IF v_transfer_completion_mode NOT IN ('manual', 'automatic') THEN
    v_transfer_completion_mode := 'manual';
  END IF;

  v_user_id := auth.uid();

  IF p_variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM public.branch_inventory
    WHERE branch_id = p_from_branch_id
      AND variant_id = p_variant_id
      AND product_id IS NULL;
  ELSE
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM public.branch_inventory
    WHERE branch_id = p_from_branch_id
      AND product_id = p_product_id
      AND variant_id IS NULL;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source inventory entry not found';
  END IF;

  IF v_previous_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for transfer. Available: %, Requested: %', v_previous_stock, p_quantity;
  END IF;

  INSERT INTO public.inventory_transfers (
    from_branch_id,
    to_branch_id,
    product_id,
    variant_id,
    quantity,
    status,
    notes,
    created_by,
    transfer_type
  )
  VALUES (
    p_from_branch_id,
    p_to_branch_id,
    p_product_id,
    p_variant_id,
    p_quantity,
    'pending',
    p_notes,
    v_user_id,
    v_transfer_type
  )
  RETURNING id INTO v_transfer_id;

  UPDATE public.branch_inventory
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE id = v_from_inventory_id;

  v_reference_type := CASE WHEN v_transfer_type = 'regular' THEN 'transfer' ELSE v_transfer_type END;

  PERFORM public.create_inventory_movement(
    v_from_inventory_id,
    'transfer_out',
    -p_quantity,
    v_previous_stock,
    v_previous_stock - p_quantity,
    v_transfer_id,
    v_reference_type,
    p_notes,
    NULL
  );

  IF v_transfer_completion_mode = 'automatic' THEN
    PERFORM public.complete_inventory_transfer(v_transfer_id);
  END IF;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper compatible con firma vieja
CREATE OR REPLACE FUNCTION public.create_inventory_transfer(
  p_from_branch_id UUID,
  p_to_branch_id UUID,
  p_quantity INTEGER,
  p_product_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  RETURN public.create_inventory_transfer(
    p_from_branch_id,
    p_to_branch_id,
    p_quantity,
    p_product_id,
    p_variant_id,
    p_notes,
    'regular'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_inventory_transfer(UUID, UUID, INTEGER, UUID, UUID, TEXT, TEXT)
IS 'Crea transferencias de inventario entre sucursales con soporte de consignación y modo de completado por organización.';

COMMENT ON FUNCTION public.create_inventory_transfer(UUID, UUID, INTEGER, UUID, UUID, TEXT)
IS 'Wrapper compatible para crear transferencias regulares.';
