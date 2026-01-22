-- Add supplier_id to inventory_movements for tracking which supplier provided the inventory
-- This is especially useful for receipt movements

-- Add supplier_id column to inventory_movements
ALTER TABLE inventory_movements
ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create index for supplier queries
CREATE INDEX idx_inventory_movements_supplier_id ON inventory_movements(supplier_id);

-- Update create_inventory_movement function to accept supplier_id
CREATE OR REPLACE FUNCTION create_inventory_movement(
  p_branch_inventory_id UUID,
  p_movement_type VARCHAR(50),
  p_quantity INTEGER,
  p_previous_stock INTEGER,
  p_new_stock INTEGER,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL
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
    created_by,
    supplier_id
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
    v_user_id,
    p_supplier_id
  )
  RETURNING id INTO v_movement_id;
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update receive_inventory function to accept supplier_id
CREATE OR REPLACE FUNCTION receive_inventory(
  p_branch_inventory_id UUID,
  p_quantity INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL
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
  
  -- Create movement record with supplier_id
  v_movement_id := create_inventory_movement(
    p_branch_inventory_id,
    'receipt',
    p_quantity,
    v_previous_stock,
    v_new_stock,
    NULL,
    'receipt',
    p_notes,
    p_supplier_id
  );
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN inventory_movements.supplier_id IS 'ID del proveedor que proporcionó la mercadería (para movimientos de tipo receipt)';
COMMENT ON FUNCTION receive_inventory(UUID, INTEGER, TEXT, UUID) IS 'Registra la recepción de mercadería (aumenta stock) con opción de asociar un proveedor';

-- Drop and recreate get_inventory_movements function to include supplier information
-- We need to drop it first because we're changing the return type
DROP FUNCTION IF EXISTS get_inventory_movements(UUID, INTEGER, INTEGER);

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
  supplier_id UUID,
  supplier_name TEXT,
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
    im.supplier_id,
    s.name::TEXT as supplier_name,
    im.created_at
  FROM inventory_movements im
  LEFT JOIN auth.users au ON im.created_by = au.id
  LEFT JOIN suppliers s ON im.supplier_id = s.id
  WHERE im.branch_inventory_id = p_branch_inventory_id
  ORDER BY im.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
