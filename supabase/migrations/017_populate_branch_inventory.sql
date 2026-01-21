-- Populate branch_inventory from legacy stock
-- This migration migrates existing stock from products.stock and product_variants.stock
-- to the new branch_inventory table for the main branch
--
-- IMPORTANT: This migration assumes:
-- 1. Migration 016 has been executed (branches and branch_inventory tables exist)
-- 2. A branch with code 'MAIN' exists (created in migration 016)
-- 3. All products have at least one variant (created in migration 010)
--
-- After this migration:
-- - branch_inventory will contain all stock for the main branch
-- - Legacy stock columns are kept but should NOT be used for new operations
-- - TODO: Update triggers to use branch_inventory instead of legacy stock

-- ============================================
-- 1. GET MAIN BRANCH ID
-- ============================================
-- We'll use a DO block to get the main branch ID and populate inventory

DO $$
DECLARE
  main_branch_id UUID;
BEGIN
  -- Get the main branch ID
  SELECT id INTO main_branch_id
  FROM branches
  WHERE code = 'MAIN'
  LIMIT 1;

  IF main_branch_id IS NULL THEN
    RAISE EXCEPTION 'Main branch (code: MAIN) not found. Please run migration 016 first.';
  END IF;

  -- ============================================
  -- 2. POPULATE INVENTORY FROM PRODUCT VARIANTS
  -- ============================================
  -- Migrate stock from product_variants to branch_inventory
  -- This covers all variants (including default variants created in migration 010)
  
  INSERT INTO branch_inventory (
    branch_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    main_branch_id,
    pv.id as variant_id,
    pv.stock,
    COALESCE(p.min_stock, 0) as min_stock,
    COALESCE(p.low_stock_threshold, 10) as low_stock_threshold
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  WHERE pv.stock > 0 OR pv.is_active = true  -- Include even if stock is 0, but product is active
  ON CONFLICT DO NOTHING;  -- Skip if already exists (shouldn't happen, but safe)

  -- Also insert variants with 0 stock if they don't exist yet
  -- This ensures all active variants have an inventory entry
  INSERT INTO branch_inventory (
    branch_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    main_branch_id,
    pv.id as variant_id,
    0 as stock,  -- Initialize with 0 if not already inserted
    COALESCE(p.min_stock, 0) as min_stock,
    COALESCE(p.low_stock_threshold, 10) as low_stock_threshold
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  WHERE pv.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM branch_inventory bi
      WHERE bi.branch_id = main_branch_id
        AND bi.variant_id = pv.id
    )
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- 3. HANDLE PRODUCTS WITHOUT VARIANTS (EDGE CASE)
  -- ============================================
  -- In theory, all products should have variants after migration 010,
  -- but we'll handle edge cases where a product might not have variants
  -- by creating inventory entries at product level
  
  INSERT INTO branch_inventory (
    branch_id,
    product_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT 
    main_branch_id,
    p.id as product_id,
    p.stock,
    COALESCE(p.min_stock, 0) as min_stock,
    COALESCE(p.low_stock_threshold, 10) as low_stock_threshold
  FROM products p
  WHERE p.is_active = true
    AND NOT EXISTS (
      -- Only insert if product has no variants
      SELECT 1 FROM product_variants pv
      WHERE pv.product_id = p.id
    )
    AND NOT EXISTS (
      -- And doesn't already have inventory entry
      SELECT 1 FROM branch_inventory bi
      WHERE bi.branch_id = main_branch_id
        AND bi.product_id = p.id
    )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Branch inventory populated successfully for branch: %', main_branch_id;
END $$;

-- ============================================
-- 4. VERIFICATION QUERIES (for manual check)
-- ============================================
-- Uncomment these to verify the migration:
-- 
-- SELECT COUNT(*) as total_variants FROM product_variants WHERE is_active = true;
-- SELECT COUNT(*) as inventory_variants FROM branch_inventory WHERE variant_id IS NOT NULL;
-- 
-- SELECT COUNT(*) as total_products FROM products WHERE is_active = true;
-- SELECT COUNT(*) as inventory_products FROM branch_inventory WHERE product_id IS NOT NULL;
--
-- Should match (or be close, accounting for edge cases)

-- ============================================
-- NOTES
-- ============================================
-- After this migration:
-- 1. All active variants should have inventory entries in branch_inventory
-- 2. Stock values are copied from legacy columns
-- 3. min_stock and low_stock_threshold are copied from products table
-- 4. Legacy stock columns (products.stock, product_variants.stock) are still present
--    but should NOT be used for new operations
-- 5. Next migration will update triggers to use branch_inventory
