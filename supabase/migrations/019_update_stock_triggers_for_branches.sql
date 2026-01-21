-- Update stock triggers to use branch_inventory instead of legacy stock
-- This migration replaces the old triggers that decremented product_variants.stock
-- with new triggers that decrement branch_inventory.stock
--
-- IMPORTANT: This migration assumes:
-- 1. Migration 016-018 have been executed
-- 2. branch_inventory is populated
-- 3. orders have branch_id set
--
-- After this migration:
-- - Stock operations will use branch_inventory
-- - Legacy stock columns are no longer updated (but kept for reference)
-- - Orders must have branch_id set (enforced by trigger)

-- ============================================
-- 1. DROP OLD TRIGGERS
-- ============================================
-- Remove the old triggers that decrement legacy stock
DROP TRIGGER IF EXISTS decrement_variant_stock_on_order_item ON order_items;
DROP TRIGGER IF EXISTS restore_variant_stock_on_order_cancellation ON orders;

-- ============================================
-- 2. CREATE NEW FUNCTION: Decrement branch inventory
-- ============================================
-- This function decrements stock from branch_inventory when an order item is created
-- It requires the order to have a branch_id

CREATE OR REPLACE FUNCTION decrement_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  variant_id_to_use UUID;
  current_stock INTEGER;
  variant_name VARCHAR;
  variant_sku VARCHAR;
BEGIN
  -- Get the branch_id from the order
  SELECT branch_id INTO order_branch_id
  FROM orders
  WHERE id = NEW.order_id;

  -- Validate that order has a branch_id
  IF order_branch_id IS NULL THEN
    RAISE EXCEPTION 'Order % does not have a branch_id. All orders must be assigned to a branch.', NEW.order_id;
  END IF;

  -- Determine which variant_id to use
  IF NEW.variant_id IS NOT NULL THEN
    variant_id_to_use := NEW.variant_id;
  ELSE
    -- Try to find default variant for this product (backward compatibility)
    SELECT id INTO variant_id_to_use
    FROM product_variants
    WHERE product_id = NEW.product_id
      AND sku LIKE '%-DEFAULT'
      AND is_active = true
    LIMIT 1;
    
    IF variant_id_to_use IS NULL THEN
      RAISE EXCEPTION 'No variant found for product %. Please create a variant first.', NEW.product_id;
    END IF;
  END IF;

  -- Get current stock from branch_inventory
  SELECT stock, pv.name, pv.sku INTO current_stock, variant_name, variant_sku
  FROM branch_inventory bi
  INNER JOIN product_variants pv ON bi.variant_id = pv.id
  WHERE bi.branch_id = order_branch_id
    AND bi.variant_id = variant_id_to_use;

  -- Check if inventory entry exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory entry not found for variant % in branch %. Please ensure inventory is set up.', 
      variant_id_to_use, order_branch_id;
  END IF;

  -- Check if there's enough stock
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for variant "%" (SKU: %) in branch. Available: %, Requested: %', 
      variant_name, variant_sku, current_stock, NEW.quantity;
  END IF;

  -- Decrement stock from branch_inventory
  UPDATE branch_inventory
  SET stock = stock - NEW.quantity
  WHERE branch_id = order_branch_id
    AND variant_id = variant_id_to_use;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. CREATE NEW FUNCTION: Restore branch inventory
-- ============================================
-- This function restores stock to branch_inventory when an order is cancelled

CREATE OR REPLACE FUNCTION restore_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
BEGIN
  -- Only restore stock if order status changed to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Get the branch_id from the order
    SELECT branch_id INTO order_branch_id
    FROM orders
    WHERE id = NEW.id;

    -- Only proceed if branch_id exists
    IF order_branch_id IS NOT NULL THEN
      -- Restore stock for all variants in the cancelled order
      UPDATE branch_inventory bi
      SET stock = stock + (
        SELECT oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id
          AND (
            oi.variant_id = bi.variant_id
            OR (
              oi.variant_id IS NULL
              AND bi.variant_id IN (
                SELECT id FROM product_variants 
                WHERE product_id = oi.product_id 
                  AND sku LIKE '%-DEFAULT' 
                  AND is_active = true
                LIMIT 1
              )
            )
          )
        LIMIT 1
      )
      WHERE bi.branch_id = order_branch_id
        AND bi.variant_id IN (
          SELECT COALESCE(
            oi.variant_id,
            (SELECT id FROM product_variants 
             WHERE product_id = oi.product_id 
               AND sku LIKE '%-DEFAULT' 
               AND is_active = true
             LIMIT 1)
          )
          FROM order_items oi
          WHERE oi.order_id = NEW.id
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. CREATE NEW TRIGGERS
-- ============================================

-- Trigger to decrement branch inventory when order items are inserted
CREATE TRIGGER decrement_branch_inventory_on_order_item
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION decrement_branch_inventory();

-- Trigger to restore branch inventory when order is cancelled
CREATE TRIGGER restore_branch_inventory_on_order_cancellation
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION restore_branch_inventory();

-- ============================================
-- 5. UPDATE HELPER FUNCTIONS
-- ============================================
-- Update the stock availability check function to use branch_inventory
-- Note: This function signature might need to change to accept branch_id
-- For now, we'll keep a version that checks the main branch

CREATE OR REPLACE FUNCTION check_variant_stock_availability(
  variant_id_param UUID,
  quantity_param INTEGER,
  branch_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  available_stock INTEGER;
  branch_to_check UUID;
BEGIN
  -- If branch_id not provided, use main branch
  IF branch_id_param IS NULL THEN
    SELECT id INTO branch_to_check
    FROM branches
    WHERE code = 'MAIN'
    LIMIT 1;
  ELSE
    branch_to_check := branch_id_param;
  END IF;

  IF branch_to_check IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get stock from branch_inventory
  SELECT stock INTO available_stock
  FROM branch_inventory
  WHERE branch_id = branch_to_check
    AND variant_id = variant_id_param;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN available_stock >= quantity_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. ADD CONSTRAINT: Orders must have branch_id
-- ============================================
-- For new orders, branch_id should be required
-- We'll add a check constraint, but make it allow NULL for backward compatibility
-- In a future migration, we can make it NOT NULL after ensuring all code sets it

-- Note: We're not adding NOT NULL constraint yet to avoid breaking existing code
-- Frontend should be updated to always set branch_id before this constraint is added

-- ============================================
-- NOTES
-- ============================================
-- After this migration:
-- 1. Stock operations now use branch_inventory instead of legacy columns
-- 2. Orders must have branch_id set (enforced by trigger)
-- 3. Legacy stock columns (products.stock, product_variants.stock) are no longer updated
-- 4. Old triggers are removed
-- 5. New triggers handle branch-based inventory
-- 6. TODO: Update frontend to always set branch_id when creating orders
-- 7. TODO: In future migration, add NOT NULL constraint to orders.branch_id
