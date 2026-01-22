-- Add inventory movements tracking and management functions
-- This migration adds support for manual inventory adjustments, receipts, and transfers

-- Create inventory_movements table to track all stock changes
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_inventory_id UUID NOT NULL REFERENCES branch_inventory(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'receipt', 'adjustment', 'transfer_out', 'transfer_in', 'sale', 'return', 'manual'
  quantity INTEGER NOT NULL, -- Positive for increases, negative for decreases
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reference_id UUID, -- ID of related order, transfer, etc.
  reference_type VARCHAR(50), -- 'order', 'transfer', 'manual', etc.
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_inventory_movements_branch_inventory_id ON inventory_movements(branch_inventory_id);
CREATE INDEX idx_inventory_movements_movement_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
CREATE INDEX idx_inventory_movements_created_by ON inventory_movements(created_by);

-- Create index for common queries (branch_inventory + date)
CREATE INDEX idx_inventory_movements_inventory_date ON inventory_movements(branch_inventory_id, created_at DESC);

-- Create transfers table for inter-branch stock transfers
CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_transit', 'completed', 'cancelled'
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT check_transfer_branches_different CHECK (from_branch_id != to_branch_id),
  CONSTRAINT check_transfer_product_or_variant_xor CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Create indexes for transfers
CREATE INDEX idx_inventory_transfers_from_branch ON inventory_transfers(from_branch_id);
CREATE INDEX idx_inventory_transfers_to_branch ON inventory_transfers(to_branch_id);
CREATE INDEX idx_inventory_transfers_status ON inventory_transfers(status);
CREATE INDEX idx_inventory_transfers_created_at ON inventory_transfers(created_at DESC);

-- Function to create inventory movement record
CREATE OR REPLACE FUNCTION create_inventory_movement(
  p_branch_inventory_id UUID,
  p_movement_type VARCHAR(50),
  p_quantity INTEGER,
  p_previous_stock INTEGER,
  p_new_stock INTEGER,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_movement_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Insert movement record
  INSERT INTO inventory_movements (
    branch_inventory_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reference_id,
    reference_type,
    notes,
    created_by
  )
  VALUES (
    p_branch_inventory_id,
    p_movement_type,
    p_quantity,
    p_previous_stock,
    p_new_stock,
    p_reference_id,
    p_reference_type,
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_movement_id;
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to adjust inventory (manual adjustment)
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_branch_inventory_id UUID,
  p_new_stock INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_previous_stock INTEGER;
  v_quantity INTEGER;
  v_movement_id UUID;
BEGIN
  -- Get current stock
  SELECT stock INTO v_previous_stock
  FROM branch_inventory
  WHERE id = p_branch_inventory_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory entry not found';
  END IF;
  
  -- Calculate quantity change
  v_quantity := p_new_stock - v_previous_stock;
  
  -- Update stock
  UPDATE branch_inventory
  SET stock = p_new_stock,
      updated_at = NOW()
  WHERE id = p_branch_inventory_id;
  
  -- Create movement record
  v_movement_id := create_inventory_movement(
    p_branch_inventory_id,
    'adjustment',
    v_quantity,
    v_previous_stock,
    p_new_stock,
    NULL,
    'manual',
    p_notes
  );
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to receive inventory (receipt from supplier)
CREATE OR REPLACE FUNCTION receive_inventory(
  p_branch_inventory_id UUID,
  p_quantity INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
  v_movement_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Receipt quantity must be greater than 0';
  END IF;
  
  -- Get current stock
  SELECT stock INTO v_previous_stock
  FROM branch_inventory
  WHERE id = p_branch_inventory_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory entry not found';
  END IF;
  
  -- Calculate new stock
  v_new_stock := v_previous_stock + p_quantity;
  
  -- Update stock
  UPDATE branch_inventory
  SET stock = v_new_stock,
      updated_at = NOW()
  WHERE id = p_branch_inventory_id;
  
  -- Create movement record
  v_movement_id := create_inventory_movement(
    p_branch_inventory_id,
    'receipt',
    p_quantity,
    v_previous_stock,
    v_new_stock,
    NULL,
    'receipt',
    p_notes
  );
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create transfer
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
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than 0';
  END IF;
  
  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same branch';
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
  
  -- Create movement record for source branch
  PERFORM create_inventory_movement(
    v_from_inventory_id,
    'transfer_out',
    -p_quantity,
    v_previous_stock,
    v_previous_stock - p_quantity,
    v_transfer_id,
    'transfer',
    p_notes
  );
  
  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete transfer (receive at destination)
CREATE OR REPLACE FUNCTION complete_inventory_transfer(
  p_transfer_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_transfer RECORD;
  v_to_inventory_id UUID;
  v_previous_stock INTEGER;
  v_new_stock INTEGER;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Get transfer details
  SELECT * INTO v_transfer
  FROM inventory_transfers
  WHERE id = p_transfer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;
  
  IF v_transfer.status != 'pending' THEN
    RAISE EXCEPTION 'Transfer is not in pending status';
  END IF;
  
  -- Find or create destination inventory entry
  IF v_transfer.variant_id IS NOT NULL THEN
    SELECT id, stock INTO v_to_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = v_transfer.to_branch_id
    AND variant_id = v_transfer.variant_id
    AND product_id IS NULL;
  ELSE
    SELECT id, stock INTO v_to_inventory_id, v_previous_stock
    FROM branch_inventory
    WHERE branch_id = v_transfer.to_branch_id
    AND product_id = v_transfer.product_id
    AND variant_id IS NULL;
  END IF;
  
  -- If inventory entry doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO branch_inventory (
      branch_id,
      product_id,
      variant_id,
      stock,
      min_stock,
      low_stock_threshold
    )
    VALUES (
      v_transfer.to_branch_id,
      v_transfer.product_id,
      v_transfer.variant_id,
      0,
      0,
      10
    )
    RETURNING id, stock INTO v_to_inventory_id, v_previous_stock;
  END IF;
  
  -- Calculate new stock
  v_new_stock := v_previous_stock + v_transfer.quantity;
  
  -- Update destination stock
  UPDATE branch_inventory
  SET stock = v_new_stock,
      updated_at = NOW()
  WHERE id = v_to_inventory_id;
  
  -- Create movement record for destination branch
  PERFORM create_inventory_movement(
    v_to_inventory_id,
    'transfer_in',
    v_transfer.quantity,
    v_previous_stock,
    v_new_stock,
    p_transfer_id,
    'transfer',
    v_transfer.notes
  );
  
  -- Update transfer status
  UPDATE inventory_transfers
  SET status = 'completed',
      completed_by = v_user_id,
      completed_at = NOW()
  WHERE id = p_transfer_id;
  
  RETURN p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for inventory_movements
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all inventory movements"
  ON inventory_movements FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert inventory movements"
  ON inventory_movements FOR INSERT
  WITH CHECK (true);

-- RLS Policies for inventory_transfers
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all inventory transfers"
  ON inventory_transfers FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert inventory transfers"
  ON inventory_transfers FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update inventory transfers"
  ON inventory_transfers FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Function to get inventory movements for a branch_inventory entry
CREATE OR REPLACE FUNCTION get_inventory_movements(
  p_branch_inventory_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  movement_type VARCHAR(50),
  quantity INTEGER,
  previous_stock INTEGER,
  new_stock INTEGER,
  reference_type VARCHAR(50),
  notes TEXT,
  created_by UUID,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    im.id,
    im.movement_type,
    im.quantity,
    im.previous_stock,
    im.new_stock,
    im.reference_type,
    im.notes,
    im.created_by,
    au.email::TEXT as user_email,
    im.created_at
  FROM inventory_movements im
  LEFT JOIN auth.users au ON im.created_by = au.id
  WHERE im.branch_inventory_id = p_branch_inventory_id
  ORDER BY im.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE inventory_movements IS 'Registro de todos los movimientos de inventario (recepciones, ajustes, transferencias, ventas, etc.)';
COMMENT ON TABLE inventory_transfers IS 'Transferencias de stock entre sucursales';
COMMENT ON FUNCTION adjust_inventory(UUID, INTEGER, TEXT) IS 'Ajusta manualmente el stock de un inventario';
COMMENT ON FUNCTION receive_inventory(UUID, INTEGER, TEXT) IS 'Registra la recepción de mercadería (aumenta stock)';
COMMENT ON FUNCTION create_inventory_transfer(UUID, UUID, INTEGER, UUID, UUID, TEXT) IS 'Crea una transferencia de stock entre sucursales';
COMMENT ON FUNCTION complete_inventory_transfer(UUID) IS 'Completa una transferencia recibiendo el stock en la sucursal destino';

-- Wrapper function for populate_missing_inventory_entries to make it accessible via RPC
-- This function directly implements the logic instead of calling the original function
-- This ensures PostgREST compatibility
CREATE OR REPLACE FUNCTION public.populate_missing_inventory_entries_rpc()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Create inventory entries for all active products that don't have entries
  INSERT INTO branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    b.id,
    p.id,
    NULL,
    0, -- Default stock to 0
    COALESCE(p.min_stock, 0),
    COALESCE(p.low_stock_threshold, 10)
  FROM branches b
  CROSS JOIN products p
  WHERE b.is_active = true
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory 
    WHERE branch_id = b.id 
    AND product_id = p.id
    AND variant_id IS NULL
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Create inventory entries for all active variants that don't have entries
  INSERT INTO branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    b.id,
    NULL,
    pv.id,
    0, -- Default stock to 0
    COALESCE(pv.min_stock, 0),
    COALESCE(pv.low_stock_threshold, 10)
  FROM branches b
  CROSS JOIN product_variants pv
  WHERE b.is_active = true
  AND pv.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory 
    WHERE branch_id = b.id 
    AND variant_id = pv.id
    AND product_id IS NULL
  );
  
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc() TO anon;

COMMENT ON FUNCTION public.populate_missing_inventory_entries_rpc() IS 'Wrapper RPC para poblar entradas de inventario faltantes. Retorna el número de entradas creadas.';
