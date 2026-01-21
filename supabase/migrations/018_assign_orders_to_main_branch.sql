-- Assign all existing orders to the main branch
-- This migration sets branch_id for all existing orders to the main branch
--
-- IMPORTANT: This migration assumes:
-- 1. Migration 016 has been executed (branches table exists, orders.branch_id column exists)
-- 2. A branch with code 'MAIN' exists
--
-- After this migration:
-- - All existing orders will have branch_id set to the main branch
-- - New orders should explicitly set branch_id (to be handled in frontend/triggers)

-- ============================================
-- 1. UPDATE EXISTING ORDERS
-- ============================================
-- Assign all orders without branch_id to the main branch

UPDATE orders
SET branch_id = (
  SELECT id FROM branches WHERE code = 'MAIN' LIMIT 1
)
WHERE branch_id IS NULL;

-- ============================================
-- 2. SET DEFAULT FOR FUTURE ORDERS (OPTIONAL)
-- ============================================
-- We could set a default, but it's better to be explicit in the application
-- So we'll leave it nullable and require explicit branch selection
-- This can be changed later if needed

-- ============================================
-- 3. VERIFICATION QUERY (for manual check)
-- ============================================
-- Uncomment to verify:
-- 
-- SELECT 
--   COUNT(*) as total_orders,
--   COUNT(branch_id) as orders_with_branch,
--   COUNT(*) FILTER (WHERE branch_id IS NULL) as orders_without_branch
-- FROM orders;
--
-- Should show: orders_without_branch = 0

-- ============================================
-- NOTES
-- ============================================
-- After this migration:
-- 1. All existing orders are assigned to the main branch
-- 2. branch_id is still nullable (for flexibility)
-- 3. Frontend/application should explicitly set branch_id for new orders
-- 4. Consider adding a NOT NULL constraint in a future migration after
--    ensuring all new orders set branch_id
