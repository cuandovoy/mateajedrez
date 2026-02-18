-- Migration: 051_organization_payment_methods.sql
-- Opción C: Métodos de pago dinámicos por organización
-- Cada organización define sus propios métodos de pago (escalable)
--
-- Cambios:
-- 1. Tabla organization_payment_methods
-- 2. orders.payment_method y order_payments.payment_method pasan de enum a VARCHAR (almacenan la key)
-- 3. Seed de métodos por defecto para cada org existente

-- ============================================
-- 1. CREAR TABLA organization_payment_methods
-- ============================================

CREATE TABLE organization_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  requires_cash_session BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, key)
);

CREATE INDEX idx_org_payment_methods_org_id ON organization_payment_methods(organization_id);
CREATE INDEX idx_org_payment_methods_active ON organization_payment_methods(organization_id, is_active) WHERE is_active = true;

CREATE TRIGGER update_organization_payment_methods_updated_at
  BEFORE UPDATE ON organization_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organization_payment_methods IS 'Métodos de pago configurables por organización. Escalable para agregar nuevos métodos sin migraciones.';

-- ============================================
-- 2. CAMBIAR payment_method DE ENUM A VARCHAR
-- ============================================
-- Permite keys dinámicas (cash, transfer, mercadopago, credit_card, etc.)

ALTER TABLE orders
  ALTER COLUMN payment_method TYPE VARCHAR(50) USING payment_method::text;

ALTER TABLE order_payments
  ALTER COLUMN payment_method TYPE VARCHAR(50) USING payment_method::text;

-- ============================================
-- 3. ACTUALIZAR FUNCIÓN calculate_cash_session_expected_amount
-- ============================================
-- Sigue usando 'cash' como key para identificar pagos en efectivo

CREATE OR REPLACE FUNCTION calculate_cash_session_expected_amount(session_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  opening DECIMAL(10, 2);
  cash_payments DECIMAL(10, 2);
BEGIN
  SELECT opening_amount INTO opening
  FROM cash_sessions WHERE id = session_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO cash_payments
  FROM order_payments
  WHERE cash_session_id = session_id
    AND payment_method = 'cash';

  RETURN opening + cash_payments;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. ACTUALIZAR FUNCIÓN get_daily_totals_by_branch
-- ============================================

DROP FUNCTION IF EXISTS get_daily_totals_by_branch(UUID, DATE);

CREATE OR REPLACE FUNCTION get_daily_totals_by_branch(
  branch_id_param UUID,
  date_param DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  payment_method TEXT,
  total_amount DECIMAL(10, 2),
  payment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.payment_method::TEXT,
    SUM(op.amount)::DECIMAL(10, 2) as total_amount,
    COUNT(*)::BIGINT as payment_count
  FROM order_payments op
  INNER JOIN orders o ON op.order_id = o.id
  WHERE o.branch_id = branch_id_param
    AND DATE(op.created_at) = date_param
  GROUP BY op.payment_method
  ORDER BY op.payment_method;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 5. SEED MÉTODOS POR DEFECTO PARA CADA ORG
-- ============================================

INSERT INTO organization_payment_methods (organization_id, key, name, config, is_active, display_order, requires_cash_session)
SELECT 
  o.id,
  m.key,
  m.name,
  '{}'::jsonb,
  true,
  m.display_order,
  m.requires_cash_session
FROM organizations o
CROSS JOIN (
  VALUES 
    ('cash', 'Efectivo', 0, true),
    ('transfer', 'Transferencia Bancaria', 1, false),
    ('mercadopago', 'Mercado Pago', 2, false)
) AS m(key, name, display_order, requires_cash_session)
ON CONFLICT (organization_id, key) DO NOTHING;

-- ============================================
-- 5b. TRIGGER: Crear métodos por defecto en nuevas organizaciones
-- ============================================

CREATE OR REPLACE FUNCTION create_default_payment_methods_for_org()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_payment_methods (organization_id, key, name, config, is_active, display_order, requires_cash_session)
  VALUES 
    (NEW.id, 'cash', 'Efectivo', '{}'::jsonb, true, 0, true),
    (NEW.id, 'transfer', 'Transferencia Bancaria', '{}'::jsonb, true, 1, false),
    (NEW.id, 'mercadopago', 'Mercado Pago', '{}'::jsonb, true, 2, false)
  ON CONFLICT (organization_id, key) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_org_created_add_payment_methods
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_payment_methods_for_org();

-- ============================================
-- 6. RLS organization_payment_methods
-- ============================================

ALTER TABLE organization_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payment methods"
  ON organization_payment_methods FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Org admins can manage payment methods"
  ON organization_payment_methods FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- ============================================
-- 7. FUNCIÓN: Obtener métodos activos de una org
-- ============================================
-- Para el storefront (puede ser público si la org está activa)

CREATE OR REPLACE FUNCTION get_org_payment_methods(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  key VARCHAR(50),
  name VARCHAR(100),
  requires_cash_session BOOLEAN,
  display_order INT
) AS $$
  SELECT 
    opm.id,
    opm.key,
    opm.name,
    opm.requires_cash_session,
    opm.display_order
  FROM organization_payment_methods opm
  WHERE opm.organization_id = p_org_id
    AND opm.is_active = true
  ORDER BY opm.display_order, opm.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
