-- Add product_images table for managing multiple images per product
-- This migration creates a separate table for product images with better structure

-- Create product_images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for product_images
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_display_order ON product_images(product_id, display_order);
CREATE INDEX idx_product_images_is_primary ON product_images(product_id, is_primary) WHERE is_primary = true;

-- Create unique constraint: only one primary image per product
CREATE UNIQUE INDEX idx_product_images_unique_primary ON product_images(product_id) WHERE is_primary = true;

-- Create trigger for updated_at
CREATE TRIGGER update_product_images_updated_at
  BEFORE UPDATE ON product_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on product_images
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view product images
CREATE POLICY "Product images are viewable by everyone"
  ON product_images FOR SELECT
  USING (true);

-- Policy: Admins can insert product images
CREATE POLICY "Product images are insertable by admins"
  ON product_images FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update product images
CREATE POLICY "Product images are updatable by admins"
  ON product_images FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete product images
CREATE POLICY "Product images are deletable by admins"
  ON product_images FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Migrate existing image_url to product_images table
-- For products with image_url, create a primary image entry
INSERT INTO product_images (product_id, image_url, display_order, is_primary)
SELECT 
  id as product_id,
  image_url,
  0 as display_order,
  true as is_primary
FROM products
WHERE image_url IS NOT NULL AND image_url != '';

-- Migrate existing images array to product_images table
-- For products with images array, create entries for each image
INSERT INTO product_images (product_id, image_url, display_order, is_primary)
SELECT 
  p.id as product_id,
  unnest(p.images) as image_url,
  row_number() OVER (PARTITION BY p.id ORDER BY array_position(p.images, unnest(p.images))) - 1 as display_order,
  CASE 
    WHEN row_number() OVER (PARTITION BY p.id ORDER BY array_position(p.images, unnest(p.images))) = 1 
    THEN true 
    ELSE false 
  END as is_primary
FROM products p
WHERE p.images IS NOT NULL AND array_length(p.images, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
  );
