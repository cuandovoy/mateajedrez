-- Fix: create_inventory_for_product and related triggers query ALL branches
-- instead of only branches belonging to the product's organization.
-- This causes the org-consistency guard (migration 090) to raise 23514.
-- Fix: filter branches by organization_id in all affected trigger functions.

-- Fix create_inventory_for_product: only touch branches of the same org
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
        NEW.stock,
        COALESCE(NEW.min_stock, 0),
        COALESCE(NEW.low_stock_threshold, 10)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix create_inventory_for_variant: only touch branches of the same org
CREATE OR REPLACE FUNCTION create_inventory_for_variant()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
  v_org_id UUID;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM products p WHERE p.id = NEW.product_id;

  FOR branch_record IN
    SELECT id FROM branches
    WHERE is_active = true
      AND organization_id = v_org_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM branch_inventory
      WHERE branch_id = branch_record.id
        AND variant_id = NEW.id
        AND product_id IS NULL
    ) THEN
      INSERT INTO branch_inventory (
        branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold
      ) VALUES (
        branch_record.id,
        NULL,
        NEW.id,
        0,
        COALESCE(NEW.min_stock, 0),
        COALESCE(NEW.low_stock_threshold, 10)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix handle_product_activation: only touch branches of the same org
CREATE OR REPLACE FUNCTION handle_product_activation()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix handle_variant_activation: only touch branches of the same org
CREATE OR REPLACE FUNCTION handle_variant_activation()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
  v_org_id UUID;
BEGIN
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
    SELECT p.organization_id INTO v_org_id
    FROM products p WHERE p.id = NEW.product_id;

    FOR branch_record IN
      SELECT id FROM branches
      WHERE is_active = true
        AND organization_id = v_org_id
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM branch_inventory
        WHERE branch_id = branch_record.id
          AND variant_id = NEW.id
          AND product_id IS NULL
      ) THEN
        INSERT INTO branch_inventory (
          branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold
        ) VALUES (
          branch_record.id,
          NULL,
          NEW.id,
          0,
          COALESCE(NEW.min_stock, 0),
          COALESCE(NEW.low_stock_threshold, 10)
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
