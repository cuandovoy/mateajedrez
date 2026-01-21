-- Add suppliers system
-- This migration creates a suppliers table and a many-to-many relationship with products

-- Create suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(100), -- Tax ID / VAT number
  website TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for suppliers
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_email ON suppliers(email);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);

-- Create unique constraint for email (optional, can be null)
CREATE UNIQUE INDEX idx_suppliers_unique_email ON suppliers(email) WHERE email IS NOT NULL;

-- Create product_suppliers junction table (many-to-many relationship)
CREATE TABLE product_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku VARCHAR(100), -- SKU from the supplier
  supplier_price DECIMAL(10, 2), -- Price from the supplier
  lead_time_days INTEGER, -- Lead time in days
  min_order_quantity INTEGER DEFAULT 1, -- Minimum order quantity
  is_primary BOOLEAN DEFAULT false, -- Primary supplier for this product
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique product-supplier combination
  CONSTRAINT unique_product_supplier UNIQUE (product_id, supplier_id)
);

-- Create indexes for product_suppliers
CREATE INDEX idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE INDEX idx_product_suppliers_is_primary ON product_suppliers(product_id, is_primary) WHERE is_primary = true;

-- Create unique constraint: only one primary supplier per product
CREATE UNIQUE INDEX idx_product_suppliers_unique_primary 
  ON product_suppliers(product_id) 
  WHERE is_primary = true;

-- Create trigger for updated_at on suppliers
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on product_suppliers
CREATE TRIGGER update_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view suppliers
CREATE POLICY "Suppliers are viewable by everyone"
  ON suppliers FOR SELECT
  USING (true);

-- Policy: Admins can insert suppliers
CREATE POLICY "Suppliers are insertable by admins"
  ON suppliers FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update suppliers
CREATE POLICY "Suppliers are updatable by admins"
  ON suppliers FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete suppliers
CREATE POLICY "Suppliers are deletable by admins"
  ON suppliers FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Enable RLS on product_suppliers
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view product-supplier relationships
CREATE POLICY "Product suppliers are viewable by everyone"
  ON product_suppliers FOR SELECT
  USING (true);

-- Policy: Admins can insert product-supplier relationships
CREATE POLICY "Product suppliers are insertable by admins"
  ON product_suppliers FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update product-supplier relationships
CREATE POLICY "Product suppliers are updatable by admins"
  ON product_suppliers FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete product-supplier relationships
CREATE POLICY "Product suppliers are deletable by admins"
  ON product_suppliers FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Helper function to get primary supplier for a product
CREATE OR REPLACE FUNCTION get_primary_supplier(p_product_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  supplier_name VARCHAR,
  supplier_sku VARCHAR,
  supplier_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    ps.supplier_sku,
    ps.supplier_price
  FROM product_suppliers ps
  JOIN suppliers s ON ps.supplier_id = s.id
  WHERE ps.product_id = p_product_id
    AND ps.is_primary = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
