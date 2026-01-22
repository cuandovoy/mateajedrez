-- Add RPC function to populate missing inventory entries
-- This function creates inventory entries for all active products/variants that don't have them
-- It's accessible via PostgREST RPC

-- Drop function if it exists (in case of previous failed attempts)
DROP FUNCTION IF EXISTS public.populate_missing_inventory_entries_rpc() CASCADE;

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.populate_missing_inventory_entries_rpc()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_variants_count INTEGER := 0;
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
  
  GET DIAGNOSTICS v_variants_count = ROW_COUNT;
  
  -- Sum both counts
  v_count := v_count + v_variants_count;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and anon (for admin access)
GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc() TO anon;

-- Add comment
COMMENT ON FUNCTION public.populate_missing_inventory_entries_rpc() IS 'RPC function para poblar entradas de inventario faltantes. Crea entradas para todos los productos y variantes activos que no las tienen. Retorna el número de entradas creadas.';
