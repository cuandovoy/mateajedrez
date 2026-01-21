-- Add product_barcodes table for managing barcode codes
-- This allows products and variants to have multiple barcode types (EAN-13, UPC, internal, etc.)

-- Create barcode type enum
CREATE TYPE barcode_type AS ENUM (
  'EAN13',      -- European Article Number (13 digits)
  'EAN8',       -- European Article Number (8 digits)
  'UPC',        -- Universal Product Code (12 digits)
  'CODE128',    -- Code 128 (variable length)
  'CODE39',     -- Code 39 (variable length)
  'INTERNAL',   -- Internal barcode (custom format)
  'SUPPLIER',   -- Supplier barcode
  'OTHER'       -- Other barcode types
);

-- Create product_barcodes table
CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  barcode VARCHAR(255) NOT NULL,
  barcode_type barcode_type NOT NULL DEFAULT 'EAN13', -- Always EAN13 for this implementation
  is_primary BOOLEAN DEFAULT false,
  notes TEXT, -- Optional notes about the barcode
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure either product_id or variant_id is set, but not both
  CONSTRAINT check_product_or_variant CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  ),
  -- Ensure barcode is unique globally
  CONSTRAINT unique_barcode UNIQUE (barcode)
);

-- Create indexes for product_barcodes
CREATE INDEX idx_product_barcodes_product_id ON product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_variant_id ON product_barcodes(variant_id);
CREATE INDEX idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX idx_product_barcodes_type ON product_barcodes(barcode_type);
CREATE INDEX idx_product_barcodes_is_primary ON product_barcodes(product_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_product_barcodes_variant_primary ON product_barcodes(variant_id, is_primary) WHERE is_primary = true;

-- Create unique constraint: only one primary barcode per product
CREATE UNIQUE INDEX idx_product_barcodes_unique_primary_product 
  ON product_barcodes(product_id) 
  WHERE is_primary = true AND product_id IS NOT NULL;

-- Create unique constraint: only one primary barcode per variant
CREATE UNIQUE INDEX idx_product_barcodes_unique_primary_variant 
  ON product_barcodes(variant_id) 
  WHERE is_primary = true AND variant_id IS NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_product_barcodes_updated_at
  BEFORE UPDATE ON product_barcodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate barcode format based on type
CREATE OR REPLACE FUNCTION validate_barcode_format(
  barcode_value TEXT,
  barcode_type_value barcode_type
) RETURNS BOOLEAN AS $$
BEGIN
  CASE barcode_type_value
    WHEN 'EAN13' THEN
      -- EAN-13: exactly 13 digits
      RETURN barcode_value ~ '^[0-9]{13}$';
    WHEN 'EAN8' THEN
      -- EAN-8: exactly 8 digits
      RETURN barcode_value ~ '^[0-9]{8}$';
    WHEN 'UPC' THEN
      -- UPC: exactly 12 digits
      RETURN barcode_value ~ '^[0-9]{12}$';
    WHEN 'CODE128', 'CODE39', 'INTERNAL', 'SUPPLIER', 'OTHER' THEN
      -- Variable length, just check it's not empty
      RETURN LENGTH(barcode_value) > 0;
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add check constraint for barcode format validation
ALTER TABLE product_barcodes
  ADD CONSTRAINT check_barcode_format
  CHECK (validate_barcode_format(barcode, barcode_type));

-- Enable RLS on product_barcodes
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view product barcodes
CREATE POLICY "Product barcodes are viewable by everyone"
  ON product_barcodes FOR SELECT
  USING (true);

-- Policy: Admins can insert product barcodes
CREATE POLICY "Product barcodes are insertable by admins"
  ON product_barcodes FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update product barcodes
CREATE POLICY "Product barcodes are updatable by admins"
  ON product_barcodes FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete product barcodes
CREATE POLICY "Product barcodes are deletable by admins"
  ON product_barcodes FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Helper function to get primary barcode for a product or variant
CREATE OR REPLACE FUNCTION get_primary_barcode(
  p_product_id UUID DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT barcode INTO result
    FROM product_barcodes
    WHERE variant_id = p_variant_id
      AND is_primary = true
    LIMIT 1;
  ELSIF p_product_id IS NOT NULL THEN
    SELECT barcode INTO result
    FROM product_barcodes
    WHERE product_id = p_product_id
      AND is_primary = true
    LIMIT 1;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
