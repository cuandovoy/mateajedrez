-- Migration: 052_plan_limits.sql
-- Límites por plan (Starter vs Profesional)
-- Triggers para productos y sucursales, actualización de orgs existentes

-- ============================================
-- 1. FUNCIONES DE VALIDACIÓN
-- ============================================

CREATE OR REPLACE FUNCTION check_product_limit(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier VARCHAR(50);
  v_limit INT;
  v_count BIGINT;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM organizations WHERE id = p_org_id;

  IF v_tier IS NULL OR v_tier = 'profesional' THEN
    RETURN true; -- Ilimitado
  END IF;

  IF v_tier = 'starter' THEN
    v_limit := 200;
  ELSE
    RETURN true;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM products
  WHERE organization_id = p_org_id;

  RETURN (v_count < v_limit);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_branch_limit(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier VARCHAR(50);
  v_limit INT;
  v_count BIGINT;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM organizations WHERE id = p_org_id;

  IF v_tier IS NULL OR v_tier = 'profesional' THEN
    RETURN true;
  END IF;

  IF v_tier = 'starter' THEN
    v_limit := 1;
  ELSE
    RETURN true;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM branches
  WHERE organization_id = p_org_id AND is_active = true;

  RETURN (v_count < v_limit);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 2. TRIGGERS PARA PRODUCTOS
-- ============================================

CREATE OR REPLACE FUNCTION before_insert_product_check_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT check_product_limit(NEW.organization_id) THEN
    RAISE EXCEPTION 'Límite de productos alcanzado (200). Actualizá tu plan a Profesional.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_insert_product_check_limit ON products;
CREATE TRIGGER before_insert_product_check_limit
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION before_insert_product_check_limit();

-- ============================================
-- 3. TRIGGERS PARA BRANCHES
-- ============================================

CREATE OR REPLACE FUNCTION before_insert_branch_check_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT check_branch_limit(NEW.organization_id) THEN
    RAISE EXCEPTION 'Plan Starter incluye 1 sucursal. Actualizá a Profesional para múltiples sucursales.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_insert_branch_check_limit ON branches;
CREATE TRIGGER before_insert_branch_check_limit
  BEFORE INSERT ON branches
  FOR EACH ROW EXECUTE FUNCTION before_insert_branch_check_limit();

-- ============================================
-- 4. ACTUALIZAR ORGS EXISTENTES
-- ============================================

UPDATE organizations
SET subscription_tier = 'starter'
WHERE subscription_tier = 'free' OR subscription_tier IS NULL;
