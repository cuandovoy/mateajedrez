-- Auto-create branch_inventory entries when products or variants are created
-- This ensures that every product/variant has inventory entries for all active branches

-- Function to create inventory entries for a product in all active branches
-- This function is called for ALL products, regardless of is_active status
-- This ensures inventory entries exist even if product is created as inactive
-- SECURITY DEFINER allows the function to bypass RLS when inserting inventory
CREATE OR REPLACE FUNCTION create_inventory_for_product()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  -- Loop through all active branches and create inventory entries
  FOR branch_record IN 
    SELECT id FROM branches WHERE is_active = true
  LOOP
    -- Check if inventory entry already exists
    IF NOT EXISTS (
      SELECT 1 FROM branch_inventory 
      WHERE branch_id = branch_record.id 
      AND product_id = NEW.id
      AND variant_id IS NULL
    ) THEN
      -- Create inventory entry with stock = 0 (admin can update later)
      INSERT INTO branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold
      )
      VALUES (
        branch_record.id,
        NEW.id,
        NULL,
        NEW.stock,
        COALESCE(NEW.min_stock, 0),
        COALESCE(NEW.low_stock_threshold, 10)
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create inventory entries for a variant in all active branches
-- This function is called for ALL variants, regardless of is_active status
-- This ensures inventory entries exist even if variant is created as inactive
-- SECURITY DEFINER allows the function to bypass RLS when inserting inventory
CREATE OR REPLACE FUNCTION create_inventory_for_variant()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  -- Loop through all active branches and create inventory entries
  FOR branch_record IN 
    SELECT id FROM branches WHERE is_active = true
  LOOP
    -- Check if inventory entry already exists
    IF NOT EXISTS (
      SELECT 1 FROM branch_inventory 
      WHERE branch_id = branch_record.id 
      AND variant_id = NEW.id
      AND product_id IS NULL
    ) THEN
      -- Create inventory entry with stock = 0 (admin can update later)
      INSERT INTO branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold
      )
      VALUES (
        branch_record.id,
        NULL,
        NEW.id,
        0, -- Default stock to 0, admin must set it
        COALESCE(NEW.min_stock, 0),
        COALESCE(NEW.low_stock_threshold, 10)
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create inventory entries when a new branch is created
-- SECURITY DEFINER allows the function to bypass RLS when inserting inventory
CREATE OR REPLACE FUNCTION create_inventory_for_new_branch()
RETURNS TRIGGER AS $$
BEGIN
  -- Create inventory entries for all active products
  INSERT INTO branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    NEW.id,
    p.id,
    NULL,
    0, -- Default stock to 0
    COALESCE(p.min_stock, 0),
    COALESCE(p.low_stock_threshold, 10)
  FROM products p
  WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory 
    WHERE branch_id = NEW.id 
    AND product_id = p.id
    AND variant_id IS NULL
  );
  
  -- Create inventory entries for all active variants
  INSERT INTO branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    NEW.id,
    NULL,
    pv.id,
    0, -- Default stock to 0
    COALESCE(pv.min_stock, 0),
    COALESCE(pv.low_stock_threshold, 10)
  FROM product_variants pv
  WHERE pv.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory 
    WHERE branch_id = NEW.id 
    AND variant_id = pv.id
    AND product_id IS NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
-- Always create inventory entries, regardless of is_active status
-- This ensures inventory is ready even if product is created as inactive
CREATE TRIGGER auto_create_inventory_on_product_insert
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_for_product();

CREATE TRIGGER auto_create_inventory_on_variant_insert
  AFTER INSERT ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_for_variant();

CREATE TRIGGER auto_create_inventory_on_branch_insert
  AFTER INSERT ON branches
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION create_inventory_for_new_branch();

-- Also handle when a product/variant is activated (is_active changes from false to true)
-- SECURITY DEFINER allows the function to bypass RLS when inserting inventory
CREATE OR REPLACE FUNCTION handle_product_activation()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  -- If product was just activated, create inventory entries
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
    FOR branch_record IN 
      SELECT id FROM branches WHERE is_active = true
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM branch_inventory 
        WHERE branch_id = branch_record.id 
        AND product_id = NEW.id
        AND variant_id IS NULL
      ) THEN
        INSERT INTO branch_inventory (
          branch_id,
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold
        )
        VALUES (
          branch_record.id,
          NEW.id,
          NULL,
          0,
          COALESCE(NEW.min_stock, 0),
          COALESCE(NEW.low_stock_threshold, 10)
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_variant_activation()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  -- If variant was just activated, create inventory entries
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
    FOR branch_record IN 
      SELECT id FROM branches WHERE is_active = true
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM branch_inventory 
        WHERE branch_id = branch_record.id 
        AND variant_id = NEW.id
        AND product_id IS NULL
      ) THEN
        INSERT INTO branch_inventory (
          branch_id,
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold
        )
        VALUES (
          branch_record.id,
          NULL,
          NEW.id,
          0,
          COALESCE(NEW.min_stock, 0),
          COALESCE(NEW.low_stock_threshold, 10)
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_inventory_on_product_activation
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL))
  EXECUTE FUNCTION handle_product_activation();

CREATE TRIGGER auto_create_inventory_on_variant_activation
  AFTER UPDATE ON product_variants
  FOR EACH ROW
  WHEN (NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL))
  EXECUTE FUNCTION handle_variant_activation();

-- Function to populate missing inventory entries for existing products/variants
-- This is a one-time fix for products created before this migration
-- SECURITY DEFINER allows the function to bypass RLS when inserting inventory
CREATE OR REPLACE FUNCTION populate_missing_inventory_entries()
RETURNS TABLE (
  created_count INTEGER
) AS $$
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
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the population function once to fix existing products
SELECT populate_missing_inventory_entries();

-- Comment on functions
COMMENT ON FUNCTION create_inventory_for_product() IS 'Crea automáticamente entradas de inventario en todas las sucursales activas cuando se crea un producto';
COMMENT ON FUNCTION create_inventory_for_variant() IS 'Crea automáticamente entradas de inventario en todas las sucursales activas cuando se crea una variante';
COMMENT ON FUNCTION create_inventory_for_new_branch() IS 'Crea automáticamente entradas de inventario para todos los productos/variantes activos cuando se crea una nueva sucursal';
COMMENT ON FUNCTION populate_missing_inventory_entries() IS 'Función para poblar entradas de inventario faltantes para productos/variantes existentes (uso único)';
Y