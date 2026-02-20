-- Migration: 053_plan_limit_inventory_transfer.sql
-- Bloquear transferencias internas para plan Starter

CREATE OR REPLACE FUNCTION create_inventory_transfer(
  p_from_branch_id UUID,
  p_to_branch_id UUID,
  p_quantity INTEGER,
  p_product_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_user_id UUID;
  v_from_inventory_id UUID;
  v_previous_stock INTEGER;
  v_org_id UUID;
  v_tier VARCHAR(50);
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than 0';
  END IF;
  
  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same branch';
  END IF;

  -- Plan check: transferencias solo para Profesional
  SELECT b.organization_id, o.subscription_tier INTO v_org_id, v_tier
  FROM branches b
  JOIN organizations o ON o.id = b.organization_id
  WHERE b.id = p_from_branch_id;

  IF v_tier = 'starter' THEN
    RAISE EXCEPTION 'Las transferencias internas están disponibles en el plan Profesional.';
  END IF;
  
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Find source inventory entry
  IF p_variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = p_from_branch_id
    AND variant_id = p_variant_id
    AND product_id IS NULL;
  ELSE
    SELECT id, stock INTO v_from_inventory_id, v_previous_stock
    FROM branch_inventory
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
  
  -- Create transfer record
  INSERT INTO inventory_transfers (
    from_branch_id,
    to_branch_id,
    product_id,
    variant_id,
    quantity,
    status,
    notes,
    created_by
  )
  VALUES (
    p_from_branch_id,
    p_to_branch_id,
    p_product_id,
    p_variant_id,
    p_quantity,
    'pending',
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_transfer_id;
  
  -- Decrease stock from source branch
  UPDATE branch_inventory
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE id = v_from_inventory_id;
  
  -- Create movement record for source branch (no supplier for transfers)
  PERFORM create_inventory_movement(
    v_from_inventory_id,
    'transfer_out',
    -p_quantity,
    v_previous_stock,
    v_previous_stock - p_quantity,
    v_transfer_id,
    'transfer',
    p_notes,
    NULL
  );
  
  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
