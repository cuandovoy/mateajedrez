-- Add stock improvements: unit of measure and stock thresholds
-- This migration adds unit of measure and stock alert functionality

-- Add unit of measure to products
ALTER TABLE products 
  ADD COLUMN unit VARCHAR(50) DEFAULT 'unidad';

-- Add stock thresholds to products
ALTER TABLE products 
  ADD COLUMN min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  ADD COLUMN low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0);

-- Add unit of measure to product_variants (optional, inherits from product if NULL)
ALTER TABLE product_variants 
  ADD COLUMN unit VARCHAR(50);

-- Add stock thresholds to product_variants
ALTER TABLE product_variants 
  ADD COLUMN min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  ADD COLUMN low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0);

-- Create function to get products/variants with low stock
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  sku VARCHAR,
  current_stock INTEGER,
  min_stock INTEGER,
  low_stock_threshold INTEGER,
  is_variant BOOLEAN,
  product_id UUID
) AS $$
BEGIN
  RETURN QUERY
  -- Get variants with low stock
  SELECT 
    pv.id,
    COALESCE(pv.name, p.name) as name,
    pv.sku,
    pv.stock as current_stock,
    COALESCE(pv.min_stock, p.min_stock, 0) as min_stock,
    COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 10) as low_stock_threshold,
    true as is_variant,
    pv.product_id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.is_active = true
  AND p.is_active = true
  AND (
    pv.stock <= COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 10)
    OR pv.stock <= COALESCE(pv.min_stock, p.min_stock, 0)
  )
  
  UNION ALL
  
  -- Get products without variants that have low stock (backward compatibility)
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.stock as current_stock,
    COALESCE(p.min_stock, 0) as min_stock,
    COALESCE(p.low_stock_threshold, 10) as low_stock_threshold,
    false as is_variant,
    p.id as product_id
  FROM products p
  WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
  )
  AND (
    p.stock <= COALESCE(p.low_stock_threshold, 10)
    OR p.stock <= COALESCE(p.min_stock, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if variant/product is low on stock
CREATE OR REPLACE FUNCTION is_low_stock(
  variant_id_param UUID DEFAULT NULL,
  product_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
  threshold INTEGER;
  min_stock_val INTEGER;
BEGIN
  IF variant_id_param IS NOT NULL THEN
    -- Check variant stock
    SELECT 
      pv.stock,
      COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 10),
      COALESCE(pv.min_stock, p.min_stock, 0)
    INTO current_stock, threshold, min_stock_val
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = variant_id_param
    AND pv.is_active = true
    AND p.is_active = true;
    
    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;
    
    RETURN current_stock <= threshold OR current_stock <= min_stock_val;
  ELSIF product_id_param IS NOT NULL THEN
    -- Check product stock (backward compatibility)
    SELECT 
      p.stock,
      COALESCE(p.low_stock_threshold, 10),
      COALESCE(p.min_stock, 0)
    INTO current_stock, threshold, min_stock_val
    FROM products p
    WHERE p.id = product_id_param
    AND p.is_active = true;
    
    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;
    
    RETURN current_stock <= threshold OR current_stock <= min_stock_val;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster low stock queries
CREATE INDEX idx_product_variants_low_stock ON product_variants(stock) WHERE is_active = true;
CREATE INDEX idx_products_low_stock ON products(stock) WHERE is_active = true;
