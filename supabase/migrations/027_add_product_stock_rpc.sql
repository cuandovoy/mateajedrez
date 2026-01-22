-- Add RPC function to get product stock from branch_inventory
-- This replaces legacy product.stock and variant.stock fields

-- Function to get stock for a product (handles variants automatically)
CREATE OR REPLACE FUNCTION get_product_stock(
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_stock INTEGER := 0;
  v_branch_id UUID;
  v_default_variant_id UUID;
BEGIN
  -- If branch_id is not provided, get the main branch
  IF p_branch_id IS NULL THEN
    SELECT id INTO v_branch_id
    FROM branches
    WHERE code = 'MAIN' AND is_active = true
    LIMIT 1;
    
    IF v_branch_id IS NULL THEN
      -- Fallback: get first active branch
      SELECT id INTO v_branch_id
      FROM branches
      WHERE is_active = true
      LIMIT 1;
    END IF;
  ELSE
    v_branch_id := p_branch_id;
  END IF;
  
  IF v_branch_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- If variant_id is provided, get stock for that variant
  IF p_variant_id IS NOT NULL THEN
    SELECT stock INTO v_stock
    FROM branch_inventory
    WHERE branch_id = v_branch_id
      AND variant_id = p_variant_id
      AND product_id IS NULL;
    
    RETURN COALESCE(v_stock, 0);
  END IF;
  
  -- If no variant_id, check if product has variants
  -- First, try to find a default variant
  SELECT id INTO v_default_variant_id
  FROM product_variants
  WHERE product_id = p_product_id
    AND sku LIKE '%-DEFAULT'
    AND is_active = true
  LIMIT 1;
  
  IF v_default_variant_id IS NOT NULL THEN
    -- Get stock for default variant
    SELECT stock INTO v_stock
    FROM branch_inventory
    WHERE branch_id = v_branch_id
      AND variant_id = v_default_variant_id
      AND product_id IS NULL;
    
    RETURN COALESCE(v_stock, 0);
  END IF;
  
  -- Check if product has any active variants
  IF EXISTS (
    SELECT 1 FROM product_variants
    WHERE product_id = p_product_id
      AND is_active = true
    LIMIT 1
  ) THEN
    -- Product has variants but no default, return 0 (variant must be selected)
    RETURN 0;
  END IF;
  
  -- No variants, get product-level stock
  SELECT stock INTO v_stock
  FROM branch_inventory
  WHERE branch_id = v_branch_id
    AND product_id = p_product_id
    AND variant_id IS NULL;
  
  RETURN COALESCE(v_stock, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get stock for multiple products at once (optimized for listings)
CREATE OR REPLACE FUNCTION get_products_stock(
  p_product_ids UUID[],
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  variant_id UUID,
  stock INTEGER
) AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  -- If branch_id is not provided, get the main branch
  IF p_branch_id IS NULL THEN
    SELECT id INTO v_branch_id
    FROM branches
    WHERE code = 'MAIN' AND is_active = true
    LIMIT 1;
    
    IF v_branch_id IS NULL THEN
      SELECT id INTO v_branch_id
      FROM branches
      WHERE is_active = true
      LIMIT 1;
    END IF;
  ELSE
    v_branch_id := p_branch_id;
  END IF;
  
  IF v_branch_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return stock for products (product-level inventory)
  RETURN QUERY
  SELECT
    bi.product_id,
    NULL::UUID as variant_id,
    bi.stock
  FROM branch_inventory bi
  WHERE bi.branch_id = v_branch_id
    AND bi.product_id = ANY(p_product_ids)
    AND bi.variant_id IS NULL;
  
  -- Return stock for default variants
  RETURN QUERY
  SELECT
    pv.product_id,
    pv.id as variant_id,
    bi.stock
  FROM product_variants pv
  INNER JOIN branch_inventory bi ON bi.variant_id = pv.id
  WHERE bi.branch_id = v_branch_id
    AND pv.product_id = ANY(p_product_ids)
    AND pv.sku LIKE '%-DEFAULT'
    AND pv.is_active = true
    AND bi.product_id IS NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_product_stock(UUID, UUID, UUID) IS 'Obtiene el stock de un producto desde branch_inventory. Maneja variantes automáticamente.';
COMMENT ON FUNCTION get_products_stock(UUID[], UUID) IS 'Obtiene el stock de múltiples productos de una vez (optimizado para listados).';
