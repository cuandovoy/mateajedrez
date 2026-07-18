-- Fix: create_inventory_for_product was copying NEW.stock into EVERY active
-- branch of the org instead of inserting 0, unlike its sibling functions
-- (create_inventory_for_variant, handle_product_activation, handle_variant_activation),
-- which all correctly hardcode 0. This caused stock to be duplicated per branch
-- on product creation (e.g. stock=10 with 2 active branches produced 2 rows of
-- 10 in branch_inventory, and products.stock synced to 20 via
-- sync_product_stock_from_inventory, migration 099).
--
-- The initial stock entered on product creation is applied afterward by the
-- application to the specifically selected branch only (see AdminProducts.tsx
-- and ProductImportModal.tsx, both of which already assume branch_inventory
-- starts at 0 for every branch).

CREATE OR REPLACE FUNCTION create_inventory_for_product()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  FOR branch_record IN
    SELECT id FROM branches
    WHERE is_active = true
      AND organization_id = NEW.organization_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_inventory
      WHERE branch_id = branch_record.id
        AND product_id = NEW.id
        AND variant_id IS NULL
    ) THEN
      INSERT INTO branch_inventory (
        branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold
      ) VALUES (
        branch_record.id,
        NEW.id,
        NULL,
        0,
        COALESCE(NEW.min_stock, 0),
        COALESCE(NEW.low_stock_threshold, 10)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
