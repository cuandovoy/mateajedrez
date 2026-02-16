-- Migration: 035_add_organization_id_part1.sql
-- Fase 1: Agregar organization_id a tablas raíz y migrar datos existentes
-- Requiere: 034_add_organizations.sql

-- ============================================
-- 1. CREAR ORGANIZACIÓN DEFAULT Y POBLAR MEMBERS
-- ============================================
INSERT INTO organizations (name, slug, subscription_tier, subscription_status)
VALUES ('Mi Organización', 'default', 'free', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Poblar organization_members desde user_profiles (usuarios con user_id)
INSERT INTO organization_members (organization_id, user_id, role)
SELECT 
  (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1),
  up.user_id,
  up.role::VARCHAR
FROM user_profiles up
WHERE up.user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================
-- 2. AGREGAR organization_id A CATEGORIES
-- ============================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE categories SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE categories ALTER COLUMN organization_id SET NOT NULL;

-- Cambiar UNIQUE(slug) a UNIQUE(organization_id, slug)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_org_slug ON categories(organization_id, slug);

CREATE INDEX IF NOT EXISTS idx_categories_organization_id ON categories(organization_id);

-- ============================================
-- 3. AGREGAR organization_id A PRODUCTS
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE products SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE products ALTER COLUMN organization_id SET NOT NULL;

-- Cambiar UNIQUE(sku) a UNIQUE(organization_id, sku)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);

CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);

-- ============================================
-- 4. AGREGAR organization_id A SUPPLIERS
-- ============================================
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE suppliers SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE suppliers ALTER COLUMN organization_id SET NOT NULL;

-- Suppliers: email único por organización
DROP INDEX IF EXISTS idx_suppliers_unique_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_org_email ON suppliers(organization_id, email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON suppliers(organization_id);

-- ============================================
-- 5. AGREGAR organization_id A BRANCHES
-- ============================================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE branches SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE branches ALTER COLUMN organization_id SET NOT NULL;

-- code puede ser NULL, unique parcial
DROP INDEX IF EXISTS idx_branches_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_code ON branches(organization_id, code) WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branches_organization_id ON branches(organization_id);

-- ============================================
-- 6. AGREGAR organization_id A CUSTOMERS
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE customers SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE customers ALTER COLUMN organization_id SET NOT NULL;

-- Cambiar UNIQUE(phone) a UNIQUE(organization_id, phone)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_phone ON customers(organization_id, phone);

CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);

-- ============================================
-- 7. AGREGAR organization_id A ORDERS
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE orders SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE orders ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
