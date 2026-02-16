-- Migration: 036_add_organization_id_part2.sql
-- Fase 1: Agregar organization_id a tablas restantes (cart, audit, etc.)
-- Requiere: 035_add_organization_id_part1.sql

-- ============================================
-- 1. CART_ITEMS - organization_id para filtrar carritos por org
-- ============================================
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE cart_items SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE cart_items ALTER COLUMN organization_id SET NOT NULL;

-- Actualizar UNIQUE para incluir organization_id (variant_id puede ser NULL)
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;
DROP INDEX IF EXISTS idx_cart_items_org_user_product;
DROP INDEX IF EXISTS idx_cart_items_org_user_product_variant;

CREATE UNIQUE INDEX idx_cart_items_org_user_product_variant 
  ON cart_items(organization_id, user_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_cart_items_organization_id ON cart_items(organization_id);

-- ============================================
-- 2. AUDIT_LOGS
-- ============================================
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE audit_logs SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

-- organization_id puede ser NULL en audit_logs para logs del sistema
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
