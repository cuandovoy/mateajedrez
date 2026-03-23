-- Migration: Auto-sync products.stock and product_variants.stock from branch_inventory
--
-- PROBLEM:
--   branch_inventory.stock is the source of truth (updated on every sale, receipt,
--   adjustment and transfer), but products.stock and product_variants.stock were
--   never automatically updated to reflect those changes.
--
-- SOLUTION:
--   A trigger on branch_inventory that recalculates the aggregate stock on
--   products and product_variants after every change, so the fallback columns
--   always reflect reality.
--
-- FORMULA:
--   product_variants.stock = SUM(branch_inventory.stock) WHERE variant_id = X
--   products.stock          = SUM(branch_inventory.stock) WHERE product_id  = X
--                           + SUM across all variants of that product
--
-- IMPACT: Zero frontend changes required. All existing fallback patterns
-- (e.g. inventoryStockByProduct.get(id) ?? product.stock) will now always
-- get an accurate value.

-- =============================================================================
-- 0. Drop legacy non-negative check on products.stock
--    products.stock is now a calculated aggregate from branch_inventory, which
--    can legitimately be negative when allow_negative_stock is enabled.
-- =============================================================================

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_check;

-- =============================================================================
-- 1. Trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_sync_product_stock_from_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_variant_id UUID;
BEGIN
  -- Resolve which row changed
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
    v_variant_id := OLD.variant_id;
  ELSE
    v_product_id := NEW.product_id;
    v_variant_id := NEW.variant_id;
  END IF;

  -- If this entry belongs to a variant: sync product_variants.stock first,
  -- then resolve the parent product_id so we can update products.stock too.
  IF v_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock = COALESCE((
      SELECT SUM(bi.stock)
      FROM branch_inventory bi
      WHERE bi.variant_id = v_variant_id
    ), 0)
    WHERE id = v_variant_id;

    -- Resolve parent product (may already be set if row had product_id, but
    -- variant entries have product_id = NULL by the XOR constraint)
    IF v_product_id IS NULL THEN
      SELECT product_id INTO v_product_id
      FROM product_variants
      WHERE id = v_variant_id;
    END IF;
  END IF;

  -- Sync products.stock = total stock across all branches for this product,
  -- including both direct (non-variant) entries and all its variants.
  IF v_product_id IS NOT NULL THEN
    UPDATE products
    SET stock = COALESCE((
      SELECT SUM(bi.stock)
      FROM branch_inventory bi
      WHERE bi.product_id = v_product_id
         OR bi.variant_id IN (
           SELECT id FROM product_variants WHERE product_id = v_product_id
         )
    ), 0)
    WHERE id = v_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Attach trigger to branch_inventory
-- =============================================================================

DROP TRIGGER IF EXISTS sync_product_stock_from_inventory ON branch_inventory;

CREATE TRIGGER sync_product_stock_from_inventory
  AFTER INSERT OR UPDATE OF stock OR DELETE
  ON branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_product_stock_from_inventory();

-- =============================================================================
-- 3. One-time backfill: bring existing products/variants in sync
-- =============================================================================

-- Sync product_variants.stock
UPDATE product_variants pv
SET stock = COALESCE((
  SELECT SUM(bi.stock)
  FROM branch_inventory bi
  WHERE bi.variant_id = pv.id
), 0)
WHERE EXISTS (
  SELECT 1 FROM branch_inventory bi WHERE bi.variant_id = pv.id
);

-- Sync products.stock (direct entries + variant entries)
UPDATE products p
SET stock = COALESCE((
  SELECT SUM(bi.stock)
  FROM branch_inventory bi
  WHERE bi.product_id = p.id
     OR bi.variant_id IN (
       SELECT id FROM product_variants WHERE product_id = p.id
     )
), 0)
WHERE EXISTS (
  SELECT 1 FROM branch_inventory bi
  WHERE bi.product_id = p.id
     OR bi.variant_id IN (
       SELECT id FROM product_variants WHERE product_id = p.id
     )
);

COMMENT ON FUNCTION trg_sync_product_stock_from_inventory IS
  'Keeps products.stock and product_variants.stock in sync with branch_inventory. '
  'Fires after every INSERT, UPDATE OF stock, or DELETE on branch_inventory. '
  'products.stock = total stock across all branches (direct + variants). '
  'product_variants.stock = total stock across all branches for that variant.';
