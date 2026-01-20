-- Add product variants system
-- This migration implements a complete variant system for products
-- Stock is now managed at variant level, not product level

-- Create product_variants table
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255), -- Display name: "Rojo - Talle M"
  attributes JSONB, -- { "color": "Rojo", "size": "M", "model": "2024" }
  price DECIMAL(10, 2), -- Variant-specific price (NULL = use product price)
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN DEFAULT true,
  image_url TEXT, -- Variant-specific image
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for product_variants
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_is_active ON product_variants(is_active);
CREATE INDEX idx_product_variants_attributes ON product_variants USING GIN(attributes);

-- Add variant_id to order_items (nullable for backward compatibility)
ALTER TABLE order_items
  ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT;

-- Add variant_id to cart_items (nullable for backward compatibility)
ALTER TABLE cart_items
  ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create indexes for variant_id
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);

-- Migrate existing stock from products to variants
-- Create a default variant for each existing product
INSERT INTO product_variants (product_id, sku, name, stock, is_active, price)
SELECT 
  id as product_id,
  sku || '-DEFAULT' as sku, -- Append -DEFAULT to existing SKU
  name || ' - Variante Principal' as name,
  stock,
  is_active,
  price
FROM products;

-- Update trigger for updated_at on product_variants
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Drop old stock trigger (will be replaced with variant-based trigger)
DROP TRIGGER IF EXISTS decrement_stock_on_order_item ON order_items;

-- Create new function to decrement variant stock
CREATE OR REPLACE FUNCTION decrement_variant_stock()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
  variant_name VARCHAR;
  variant_sku VARCHAR;
BEGIN
  -- If variant_id is NULL, try to use product_id (backward compatibility)
  IF NEW.variant_id IS NULL THEN
    -- Try to find default variant for this product
    SELECT id, stock, name, sku INTO NEW.variant_id, current_stock, variant_name, variant_sku
    FROM product_variants
    WHERE product_id = NEW.product_id
    AND sku LIKE '%-DEFAULT'
    LIMIT 1;
    
    -- If no default variant found, raise error
    IF NEW.variant_id IS NULL THEN
      RAISE EXCEPTION 'No variant found for product %. Please create a variant first.', NEW.product_id;
    END IF;
  ELSE
    -- Get variant stock
    SELECT stock, name, sku INTO current_stock, variant_name, variant_sku
    FROM product_variants
    WHERE id = NEW.variant_id;
  END IF;
  
  -- Check if variant exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant % not found', NEW.variant_id;
  END IF;
  
  -- Check if there's enough stock
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for variant "%" (SKU: %). Available: %, Requested: %', 
      variant_name, variant_sku, current_stock, NEW.quantity;
  END IF;
  
  -- Decrement stock
  UPDATE product_variants
  SET stock = stock - NEW.quantity
  WHERE id = NEW.variant_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to decrement variant stock when order items are inserted
CREATE TRIGGER decrement_variant_stock_on_order_item
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION decrement_variant_stock();

-- Update function to restore variant stock
CREATE OR REPLACE FUNCTION restore_variant_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore stock if order status changed to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Restore stock for all variants in the cancelled order
    UPDATE product_variants
    SET stock = stock + (
      SELECT quantity
      FROM order_items
      WHERE order_items.order_id = NEW.id
      AND (
        order_items.variant_id = product_variants.id
        OR (
          order_items.variant_id IS NULL
          AND order_items.product_id = product_variants.product_id
          AND product_variants.sku LIKE '%-DEFAULT'
        )
      )
    )
    WHERE id IN (
      SELECT COALESCE(variant_id, (
        SELECT id FROM product_variants 
        WHERE product_id = order_items.product_id 
        AND sku LIKE '%-DEFAULT' 
        LIMIT 1
      ))
      FROM order_items
      WHERE order_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to restore variant stock
DROP TRIGGER IF EXISTS restore_stock_on_order_cancellation ON orders;

CREATE TRIGGER restore_variant_stock_on_order_cancellation
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION restore_variant_stock();

-- Update function to check variant stock availability
CREATE OR REPLACE FUNCTION check_variant_stock_availability(
  variant_id_param UUID,
  quantity_param INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  available_stock INTEGER;
BEGIN
  SELECT stock INTO available_stock
  FROM product_variants
  WHERE id = variant_id_param
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN available_stock >= quantity_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available stock for multiple variants
CREATE OR REPLACE FUNCTION get_variants_stock(
  variant_ids UUID[]
)
RETURNS TABLE (
  variant_id UUID,
  available_stock INTEGER,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id as variant_id,
    pv.stock as available_stock,
    (pv.stock > 0 AND pv.is_active = true) as is_available
  FROM product_variants pv
  WHERE pv.id = ANY(variant_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We keep the stock column in products for backward compatibility
-- but it should not be used for new orders. All new stock management
-- should use product_variants.
