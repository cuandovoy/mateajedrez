-- Add multi-branch (multi-store) support
-- This migration creates branches table and branch-based inventory system
-- 
-- IMPORTANT: This is the foundation for multi-store support.
-- Legacy stock columns (products.stock, product_variants.stock) are kept
-- for backward compatibility but should NOT be used for new stock logic.
-- TODO: Remove legacy stock columns in a future migration after full migration.

-- ============================================
-- 1. CREATE BRANCHES TABLE
-- ============================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE, -- Optional: short code like "MAIN", "BRANCH-01"
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for branches
CREATE INDEX idx_branches_name ON branches(name);
CREATE INDEX idx_branches_code ON branches(code) WHERE code IS NOT NULL;
CREATE INDEX idx_branches_is_active ON branches(is_active);

-- Create unique constraint for email (optional, can be null)
CREATE UNIQUE INDEX idx_branches_unique_email ON branches(email) WHERE email IS NOT NULL;

-- Create trigger for updated_at on branches
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. CREATE BRANCH_INVENTORY TABLE
-- ============================================
-- This table stores stock per branch for products and variants
-- Rules:
--   - One row per (branch_id, product_id) for simple products
--   - One row per (branch_id, variant_id) for variant products
--   - Exactly ONE of product_id or variant_id must be NOT NULL (XOR rule)
--   - Unique constraints prevent duplicates

CREATE TABLE branch_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- XOR constraint: exactly one of product_id or variant_id must be NOT NULL
  CONSTRAINT check_product_or_variant_xor CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Create indexes for branch_inventory
CREATE INDEX idx_branch_inventory_branch_id ON branch_inventory(branch_id);
CREATE INDEX idx_branch_inventory_product_id ON branch_inventory(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_branch_inventory_variant_id ON branch_inventory(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_branch_inventory_stock ON branch_inventory(stock);
CREATE INDEX idx_branch_inventory_low_stock ON branch_inventory(branch_id, stock) 
  WHERE stock <= low_stock_threshold;

-- Create unique constraints: prevent duplicate inventory entries
-- For products: one row per (branch_id, product_id)
CREATE UNIQUE INDEX unique_branch_product 
  ON branch_inventory(branch_id, product_id) 
  WHERE product_id IS NOT NULL;

-- For variants: one row per (branch_id, variant_id)
CREATE UNIQUE INDEX unique_branch_variant 
  ON branch_inventory(branch_id, variant_id) 
  WHERE variant_id IS NOT NULL;

-- Create trigger for updated_at on branch_inventory
CREATE TRIGGER update_branch_inventory_updated_at
  BEFORE UPDATE ON branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. ADD BRANCH_ID TO ORDERS TABLE
-- ============================================
-- Add branch_id column to orders (nullable initially for migration)
ALTER TABLE orders
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

-- Create index for branch_id on orders
CREATE INDEX idx_orders_branch_id ON orders(branch_id);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active branches (or all if admin)
CREATE POLICY "Branches are viewable by everyone"
  ON branches FOR SELECT
  USING (
    is_active = true 
    OR public.is_admin(auth.uid())
  );

-- Policy: Admins can insert branches
CREATE POLICY "Branches are insertable by admins"
  ON branches FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update branches
CREATE POLICY "Branches are updatable by admins"
  ON branches FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete branches
CREATE POLICY "Branches are deletable by admins"
  ON branches FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Enable RLS on branch_inventory
ALTER TABLE branch_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all branch inventory
CREATE POLICY "Branch inventory is viewable by admins"
  ON branch_inventory FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policy: Admins can insert branch inventory
CREATE POLICY "Branch inventory is insertable by admins"
  ON branch_inventory FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update branch inventory
CREATE POLICY "Branch inventory is updatable by admins"
  ON branch_inventory FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete branch inventory
CREATE POLICY "Branch inventory is deletable by admins"
  ON branch_inventory FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- 5. SEED DATA: CREATE DEFAULT "MAIN BRANCH"
-- ============================================
-- Create a default branch for existing orders and inventory migration
-- This branch will be used as the default for all existing orders
-- In the next migration, we'll query for this branch by code 'MAIN' to populate inventory
INSERT INTO branches (name, code, is_active, notes)
VALUES (
  'Sucursal Principal',
  'MAIN',
  true,
  'Sucursal principal creada automáticamente durante la migración a multi-sucursal'
);

-- ============================================
-- 6. HELPER FUNCTION: Get low stock items by branch
-- ============================================
-- This RPC function will be useful for admin dashboards
CREATE OR REPLACE FUNCTION get_low_stock_items_by_branch(branch_id_param UUID)
RETURNS TABLE (
  id UUID,
  branch_id UUID,
  product_id UUID,
  variant_id UUID,
  stock INTEGER,
  min_stock INTEGER,
  low_stock_threshold INTEGER,
  product_name TEXT,
  variant_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bi.id,
    bi.branch_id,
    bi.product_id,
    bi.variant_id,
    bi.stock,
    bi.min_stock,
    bi.low_stock_threshold,
    CASE 
      WHEN bi.product_id IS NOT NULL THEN p.name
      ELSE NULL
    END as product_name,
    CASE 
      WHEN bi.variant_id IS NOT NULL THEN pv.name
      ELSE NULL
    END as variant_name
  FROM branch_inventory bi
  LEFT JOIN products p ON bi.product_id = p.id
  LEFT JOIN product_variants pv ON bi.variant_id = pv.id
  WHERE bi.branch_id = branch_id_param
    AND bi.stock <= bi.low_stock_threshold
  ORDER BY bi.stock ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- NOTES FOR NEXT MIGRATIONS
-- ============================================
-- Next steps (to be done in subsequent migrations):
-- 1. Populate branch_inventory from legacy stock (products.stock, product_variants.stock)
-- 2. Assign all existing orders to the main branch
-- 3. Create functions to decrement/restore inventory from branch_inventory
-- 4. Update triggers to use branch_inventory instead of legacy stock
-- 5. Add cash_sessions and order_payments tables
-- 6. Update frontend to support branch selection
