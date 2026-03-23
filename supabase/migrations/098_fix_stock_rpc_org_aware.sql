-- Migration: 098_fix_stock_rpc_org_aware.sql
-- Problema: get_product_stock y get_products_stock no aceptan organization_id,
-- por lo que el código frontend usa queries directas a branches/branch_inventory
-- (bloqueadas por RLS para usuarios anónimos).
-- Solución: agregar p_organization_id para filtrar branches por org.
-- Las funciones son SECURITY DEFINER, por lo que bypasean RLS y funcionan para anónimos.

CREATE OR REPLACE FUNCTION get_product_stock(
  p_product_id    UUID,
  p_variant_id    UUID    DEFAULT NULL,
  p_branch_id     UUID    DEFAULT NULL,
  p_organization_id UUID  DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_stock              INTEGER := 0;
  v_branch_id          UUID;
  v_default_variant_id UUID;
BEGIN
  -- Resolver branch
  IF p_branch_id IS NOT NULL THEN
    v_branch_id := p_branch_id;
  ELSE
    -- Buscar rama MAIN filtrando por org si se proporciona
    SELECT id INTO v_branch_id
    FROM branches
    WHERE code = 'MAIN'
      AND is_active = true
      AND is_isolated_warehouse = false
      AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    ORDER BY created_at
    LIMIT 1;

    IF v_branch_id IS NULL THEN
      -- Fallback: primera rama activa de la org
      SELECT id INTO v_branch_id
      FROM branches
      WHERE is_active = true
        AND is_isolated_warehouse = false
        AND (p_organization_id IS NULL OR organization_id = p_organization_id)
      ORDER BY created_at
      LIMIT 1;
    END IF;
  END IF;

  IF v_branch_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Si se especifica variante, devolver su stock directamente
  IF p_variant_id IS NOT NULL THEN
    SELECT stock INTO v_stock
    FROM branch_inventory
    WHERE branch_id = v_branch_id
      AND variant_id = p_variant_id
      AND product_id IS NULL;
    RETURN COALESCE(v_stock, 0);
  END IF;

  -- Buscar variante DEFAULT
  SELECT id INTO v_default_variant_id
  FROM product_variants
  WHERE product_id = p_product_id
    AND sku LIKE '%-DEFAULT'
    AND is_active = true
  LIMIT 1;

  IF v_default_variant_id IS NOT NULL THEN
    SELECT stock INTO v_stock
    FROM branch_inventory
    WHERE branch_id = v_branch_id
      AND variant_id = v_default_variant_id
      AND product_id IS NULL;
    RETURN COALESCE(v_stock, 0);
  END IF;

  -- Si tiene variantes activas (sin DEFAULT), retornar 0 (requiere selección)
  IF EXISTS (
    SELECT 1 FROM product_variants
    WHERE product_id = p_product_id AND is_active = true
    LIMIT 1
  ) THEN
    RETURN 0;
  END IF;

  -- Sin variantes: stock a nivel de producto
  SELECT stock INTO v_stock
  FROM branch_inventory
  WHERE branch_id = v_branch_id
    AND product_id = p_product_id
    AND variant_id IS NULL;

  RETURN COALESCE(v_stock, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_products_stock(
  p_product_ids     UUID[],
  p_branch_id       UUID    DEFAULT NULL,
  p_organization_id UUID    DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  variant_id UUID,
  stock      INTEGER
) AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  -- Resolver branch
  IF p_branch_id IS NOT NULL THEN
    v_branch_id := p_branch_id;
  ELSE
    SELECT id INTO v_branch_id
    FROM branches
    WHERE code = 'MAIN'
      AND is_active = true
      AND is_isolated_warehouse = false
      AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    ORDER BY created_at
    LIMIT 1;

    IF v_branch_id IS NULL THEN
      SELECT id INTO v_branch_id
      FROM branches
      WHERE is_active = true
        AND is_isolated_warehouse = false
        AND (p_organization_id IS NULL OR organization_id = p_organization_id)
      ORDER BY created_at
      LIMIT 1;
    END IF;
  END IF;

  IF v_branch_id IS NULL THEN
    RETURN;
  END IF;

  -- Stock a nivel de producto
  RETURN QUERY
  SELECT bi.product_id, NULL::UUID AS variant_id, bi.stock
  FROM branch_inventory bi
  WHERE bi.branch_id = v_branch_id
    AND bi.product_id = ANY(p_product_ids)
    AND bi.variant_id IS NULL;

  -- Stock de variantes DEFAULT
  RETURN QUERY
  SELECT pv.product_id, pv.id AS variant_id, bi.stock
  FROM product_variants pv
  INNER JOIN branch_inventory bi ON bi.variant_id = pv.id
  WHERE bi.branch_id = v_branch_id
    AND pv.product_id = ANY(p_product_ids)
    AND pv.sku LIKE '%-DEFAULT'
    AND pv.is_active = true
    AND bi.product_id IS NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_product_stock(UUID, UUID, UUID, UUID) IS
  'Stock de un producto desde branch_inventory. Acepta organization_id para multi-tenant. SECURITY DEFINER: accesible para usuarios anónimos.';
COMMENT ON FUNCTION get_products_stock(UUID[], UUID, UUID) IS
  'Stock de múltiples productos. Acepta organization_id para multi-tenant. SECURITY DEFINER: accesible para usuarios anónimos.';
