-- =============================================================================
-- MIGRACIÓN CONSOLIDADA - INSTALACIÓN EN BASE DE DATOS EN BLANCO
-- =============================================================================
-- Este archivo contiene TODO el schema del proyecto para ejecutar en un Supabase
-- completamente vacío. Incluye multi-tenant desde el inicio.
--
-- USO:
--   1. Crear un proyecto Supabase nuevo (o usar uno vacío)
--   2. Ejecutar este archivo en el SQL Editor de Supabase Dashboard
--      O: supabase db push (si este es el único archivo en migrations/)
--
-- NO ejecutar si ya tienes las migraciones 001-038 aplicadas.
--
-- INCLUYE:
--   - Organizations y organization_members (multi-tenant)
--   - Todas las tablas de negocio con organization_id
--   - RBAC (roles, permissions)
--   - Storage buckets y políticas
--   - RLS multi-tenant en todas las tablas
--   - Triggers: handle_new_user, stock, auto-create inventory
--   - Funciones: get_org_by_slug, get_public_products, etc.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================
CREATE TYPE user_role AS ENUM ('user', 'admin', 'manager', 'viewer');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('transfer', 'mercadopago', 'cash');
CREATE TYPE barcode_type AS ENUM ('EAN13', 'EAN8', 'UPC', 'CODE128', 'CODE39', 'INTERNAL', 'SUPPLIER', 'OTHER');

-- =============================================================================
-- FUNCIÓN BASE: update_updated_at_column
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ORGANIZACIONES (Multi-tenant - debe ir primero)
-- =============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color VARCHAR(7),
  settings JSONB DEFAULT '{}',
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);
CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Organización default
INSERT INTO organizations (name, slug, subscription_tier, subscription_status)
VALUES ('Mi Organización', 'default', 'free', 'active');

-- =============================================================================
-- CATEGORIES (con organization_id desde el inicio)
-- =============================================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) NOT NULL,
  image_url TEXT,
  parent_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_categories_org_slug ON categories(organization_id, slug);
CREATE INDEX idx_categories_organization_id ON categories(organization_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
ALTER TABLE categories ADD CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PRODUCTS (con organization_id)
-- =============================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  image_url TEXT,
  images TEXT[],
  sku VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  unit VARCHAR(50) DEFAULT 'unidad',
  min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- USER_PROFILES
-- =============================================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'user',
  full_name VARCHAR(255),
  phone VARCHAR(50),
  address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX user_profiles_user_id_unique ON user_profiles (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PRODUCT_VARIANTS
-- =============================================================================
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  attributes JSONB,
  price DECIMAL(10, 2),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  unit VARCHAR(50),
  min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_product_variants_product_sku ON product_variants(product_id, sku);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ORDERS (con organization_id, user_id nullable para guest)
-- customer_id y branch_id se agregan después de crear customers y branches
-- =============================================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  status order_status DEFAULT 'pending',
  shipping_address JSONB NOT NULL,
  payment_method payment_method DEFAULT 'transfer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_organization_id ON orders(organization_id);
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ORDER_ITEMS
-- =============================================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

-- =============================================================================
-- CART_ITEMS (con organization_id)
-- =============================================================================
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_cart_items_org_user_product_variant ON cart_items(organization_id, user_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_organization_id ON cart_items(organization_id);
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SUPPLIERS (con organization_id)
-- =============================================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(100),
  website TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_suppliers_org_email ON suppliers(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_suppliers_organization_id ON suppliers(organization_id);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PRODUCT_SUPPLIERS
-- =============================================================================
CREATE TABLE product_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku VARCHAR(100),
  supplier_price DECIMAL(10, 2),
  lead_time_days INTEGER,
  min_order_quantity INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);
CREATE INDEX idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE TRIGGER update_product_suppliers_updated_at BEFORE UPDATE ON product_suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- BRANCHES (con organization_id)
-- =============================================================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_branches_org_code ON branches(organization_id, code) WHERE code IS NOT NULL;
CREATE INDEX idx_branches_organization_id ON branches(organization_id);
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sucursal principal default
INSERT INTO branches (organization_id, name, code, is_active, notes)
SELECT id, 'Sucursal Principal', 'MAIN', true, 'Sucursal principal'
FROM organizations WHERE slug = 'default' LIMIT 1;

-- =============================================================================
-- CUSTOMERS (con organization_id)
-- =============================================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address JSONB,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_customers_org_phone ON customers(organization_id, phone);
CREATE INDEX idx_customers_organization_id ON customers(organization_id);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Agregar branch_id y customer_id a orders
ALTER TABLE orders ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT;
CREATE INDEX idx_orders_branch_id ON orders(branch_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- =============================================================================
-- PRODUCT_IMAGES
-- =============================================================================
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_product_images_unique_primary ON product_images(product_id) WHERE is_primary = true;
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE TRIGGER update_product_images_updated_at BEFORE UPDATE ON product_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PRODUCT_BARCODES
-- =============================================================================
CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  barcode VARCHAR(255) NOT NULL,
  barcode_type barcode_type NOT NULL DEFAULT 'EAN13',
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_product_or_variant CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX idx_product_barcodes_product_id ON product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_variant_id ON product_barcodes(variant_id);

CREATE OR REPLACE FUNCTION validate_barcode_format(barcode_value TEXT, barcode_type_value barcode_type)
RETURNS BOOLEAN AS $$
BEGIN
  CASE barcode_type_value
    WHEN 'EAN13' THEN RETURN barcode_value ~ '^[0-9]{13}$';
    WHEN 'EAN8' THEN RETURN barcode_value ~ '^[0-9]{8}$';
    WHEN 'UPC' THEN RETURN barcode_value ~ '^[0-9]{12}$';
    ELSE RETURN LENGTH(barcode_value) > 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE product_barcodes ADD CONSTRAINT check_barcode_format CHECK (validate_barcode_format(barcode, barcode_type));
CREATE TRIGGER update_product_barcodes_updated_at BEFORE UPDATE ON product_barcodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- BRANCH_INVENTORY
-- =============================================================================
CREATE TABLE branch_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER DEFAULT 0 CHECK (min_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_product_or_variant_xor CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX unique_branch_product ON branch_inventory(branch_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX unique_branch_variant ON branch_inventory(branch_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_branch_inventory_branch_id ON branch_inventory(branch_id);
CREATE TRIGGER update_branch_inventory_updated_at BEFORE UPDATE ON branch_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CASH_SESSIONS y ORDER_PAYMENTS
-- =============================================================================
CREATE TABLE cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  expected_amount DECIMAL(10, 2),
  closing_amount DECIMAL(10, 2),
  difference DECIMAL(10, 2),
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_cash_sessions_one_open_per_branch ON cash_sessions(branch_id) WHERE closed_at IS NULL;
CREATE INDEX idx_cash_sessions_branch_id ON cash_sessions(branch_id);
CREATE TRIGGER update_cash_sessions_updated_at BEFORE UPDATE ON cash_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);

-- =============================================================================
-- AUDIT_LOGS (con organization_id nullable)
-- =============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================================
-- INVENTORY_MOVEMENTS y INVENTORY_TRANSFERS
-- =============================================================================
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_inventory_id UUID NOT NULL REFERENCES branch_inventory(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_movements_branch_inventory_id ON inventory_movements(branch_inventory_id);

CREATE TABLE inventory_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT check_transfer_branches_different CHECK (from_branch_id != to_branch_id),
  CONSTRAINT check_transfer_product_or_variant_xor CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- =============================================================================
-- RBAC: ROLES, PERMISSIONS, ROLES_PERMISSIONS, USER_PERMISSIONS
-- =============================================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, permission_id)
);

CREATE TABLE rbac_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert roles y permissions (simplificado - ver 029 para lista completa)
INSERT INTO roles (key, name, description, is_system) VALUES
  ('admin', 'Administrador', 'Acceso completo', true),
  ('manager', 'Gerente', 'Gestión operativa', true),
  ('viewer', 'Visualizador', 'Solo lectura', true),
  ('user', 'Usuario', 'Usuario regular', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions (key, name, category) VALUES
  ('products:view', 'Ver productos', 'products'),
  ('products:create', 'Crear productos', 'products'),
  ('products:edit', 'Editar productos', 'products'),
  ('products:delete', 'Eliminar productos', 'products'),
  ('products:manage_stock', 'Gestionar stock', 'products'),
  ('categories:view', 'Ver categorías', 'categories'),
  ('categories:create', 'Crear categorías', 'categories'),
  ('categories:edit', 'Editar categorías', 'categories'),
  ('categories:delete', 'Eliminar categorías', 'categories'),
  ('orders:view', 'Ver órdenes', 'orders'),
  ('orders:edit', 'Editar órdenes', 'orders'),
  ('customers:view', 'Ver clientes', 'customers'),
  ('customers:create', 'Crear clientes', 'customers'),
  ('customers:edit', 'Editar clientes', 'customers'),
  ('customers:delete', 'Eliminar clientes', 'customers'),
  ('cash_register:access', 'Acceso a caja', 'cash_register'),
  ('inventory:view', 'Ver inventario', 'inventory'),
  ('inventory:manage', 'Gestionar inventario', 'inventory'),
  ('settings:manage_roles', 'Gestionar roles', 'settings')
ON CONFLICT (key) DO NOTHING;

-- Asignar todos los permisos a admin
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.key = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- VIEW user_all_permissions (usa organization_members para multi-tenant)
-- =============================================================================
CREATE OR REPLACE VIEW user_all_permissions AS
SELECT DISTINCT
  om.user_id,
  p.id as permission_id,
  p.key as permission_key,
  p.name as permission_name,
  p.category as permission_category,
  'role' as source,
  NULL::TIMESTAMPTZ as expires_at
FROM organization_members om
JOIN roles r ON om.role = r.key
JOIN roles_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
UNION ALL
SELECT
  upl.user_id,
  p.id as permission_id,
  p.key as permission_key,
  p.name as permission_name,
  p.category as permission_category,
  'user' as source,
  upl.expires_at
FROM user_permissions upl
JOIN permissions p ON upl.permission_id = p.id
WHERE (upl.expires_at IS NULL OR upl.expires_at > NOW());

-- =============================================================================
-- FUNCIONES HELPER MULTI-TENANT
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members om
    JOIN roles r ON r.key = om.role
    JOIN roles_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE om.user_id = auth.uid() AND om.organization_id = p_org_id AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- is_admin para compatibilidad (usa organization_members - cualquier org)
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = user_id_param AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- RPC PÚBLICOS para store sin auth
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_org_by_slug(p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, logo_url TEXT, primary_color TEXT)
AS $$
  SELECT o.id, o.name::TEXT, o.slug::TEXT, o.logo_url::TEXT, o.primary_color::TEXT
  FROM organizations o
  WHERE o.slug = p_slug AND o.subscription_status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_public_products(p_org_id UUID)
RETURNS SETOF products AS $$
  SELECT * FROM products WHERE organization_id = p_org_id AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_public_categories(p_org_id UUID)
RETURNS SETOF categories AS $$
  SELECT * FROM categories WHERE organization_id = p_org_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- FUNCIÓN create_audit_log
-- =============================================================================
CREATE OR REPLACE FUNCTION create_audit_log(
  p_table_name VARCHAR(100),
  p_record_id UUID,
  p_action VARCHAR(50),
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_changed_fields TEXT[];
BEGIN
  IF p_action = 'UPDATE' AND p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
    SELECT ARRAY_AGG(key) INTO v_changed_fields
    FROM (SELECT key FROM jsonb_each(p_new_data) WHERE (p_old_data->>key) IS DISTINCT FROM (p_new_data->>key)) AS changed;
  END IF;
  
  INSERT INTO audit_logs (table_name, record_id, action, user_id, old_data, new_data, changed_fields, notes)
  VALUES (p_table_name, p_record_id, p_action, auth.uid(), p_old_data, p_new_data, v_changed_fields, p_notes)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- AUTO-CREATE branch_inventory cuando se crean productos/variantes
-- =============================================================================
CREATE OR REPLACE FUNCTION create_inventory_for_product()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
BEGIN
  FOR branch_record IN SELECT id FROM branches WHERE is_active = true AND organization_id = NEW.organization_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM branch_inventory WHERE branch_id = branch_record.id AND product_id = NEW.id AND variant_id IS NULL) THEN
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
      VALUES (branch_record.id, NEW.id, NULL, 0, COALESCE(NEW.min_stock, 0), COALESCE(NEW.low_stock_threshold, 10));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_inventory_for_variant()
RETURNS TRIGGER AS $$
DECLARE
  branch_record RECORD;
  prod_org_id UUID;
  v_min_stock INT;
  v_low_threshold INT;
BEGIN
  SELECT organization_id, COALESCE(min_stock, 0), COALESCE(low_stock_threshold, 10)
  INTO prod_org_id, v_min_stock, v_low_threshold FROM products WHERE id = NEW.product_id;
  
  FOR branch_record IN SELECT id FROM branches WHERE is_active = true AND organization_id = prod_org_id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM branch_inventory WHERE branch_id = branch_record.id AND variant_id = NEW.id AND product_id IS NULL) THEN
      INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
      VALUES (branch_record.id, NULL, NEW.id, 0, COALESCE(NEW.min_stock, v_min_stock), COALESCE(NEW.low_stock_threshold, v_low_threshold));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_inventory_for_product
  AFTER INSERT ON products FOR EACH ROW EXECUTE FUNCTION create_inventory_for_product();

CREATE TRIGGER auto_create_inventory_for_variant
  AFTER INSERT ON product_variants FOR EACH ROW EXECUTE FUNCTION create_inventory_for_variant();

-- =============================================================================
-- TRIGGERS: Stock (branch_inventory), handle_new_user
-- =============================================================================
CREATE OR REPLACE FUNCTION decrement_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
  variant_id_to_use UUID;
  current_stock INTEGER;
BEGIN
  SELECT branch_id INTO order_branch_id FROM orders WHERE id = NEW.order_id;
  IF order_branch_id IS NULL THEN
    RAISE EXCEPTION 'Order % does not have branch_id', NEW.order_id;
  END IF;

  IF NEW.variant_id IS NOT NULL THEN
    variant_id_to_use := NEW.variant_id;
  ELSE
    SELECT id INTO variant_id_to_use FROM product_variants
    WHERE product_id = NEW.product_id AND sku LIKE '%-DEFAULT' AND is_active = true LIMIT 1;
    IF variant_id_to_use IS NULL THEN
      RAISE EXCEPTION 'No variant found for product %', NEW.product_id;
    END IF;
  END IF;

  SELECT stock INTO current_stock FROM branch_inventory bi
  WHERE bi.branch_id = order_branch_id AND bi.variant_id = variant_id_to_use;

  IF NOT FOUND OR current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  UPDATE branch_inventory SET stock = stock - NEW.quantity
  WHERE branch_id = order_branch_id AND variant_id = variant_id_to_use;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_branch_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_branch_id UUID;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    SELECT branch_id INTO order_branch_id FROM orders WHERE id = NEW.id;
    IF order_branch_id IS NOT NULL THEN
      UPDATE branch_inventory bi SET stock = stock + (
        SELECT oi.quantity FROM order_items oi
        WHERE oi.order_id = NEW.id AND (oi.variant_id = bi.variant_id OR (
          oi.variant_id IS NULL AND bi.variant_id IN (
            SELECT id FROM product_variants WHERE product_id = oi.product_id AND sku LIKE '%-DEFAULT' AND is_active = true LIMIT 1
          )
        ))
        LIMIT 1
      )
      WHERE bi.branch_id = order_branch_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decrement_branch_inventory_on_order_item
  AFTER INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION decrement_branch_inventory();

CREATE TRIGGER restore_branch_inventory_on_order_cancellation
  AFTER UPDATE ON orders FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION restore_branch_inventory();

-- handle_new_user: crea user_profiles Y organization_members
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (user_id, role, full_name)
    SELECT NEW.id, 'user', COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
    WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.user_id = NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1), NEW.id, 'user'
    WHERE EXISTS (SELECT 1 FROM organizations WHERE slug = 'default')
    AND NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = NEW.id AND om.organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1));
  EXCEPTION WHEN unique_violation THEN NULL;
  WHEN OTHERS THEN RAISE WARNING 'handle_new_user org_member failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true), ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Product images public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Category images public read" ON storage.objects FOR SELECT USING (bucket_id = 'category-images');
CREATE POLICY "Admins upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins upload category images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'category-images' AND public.is_admin(auth.uid()));

-- =============================================================================
-- RLS - Políticas multi-tenant (todas las tablas)
-- =============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_log ENABLE ROW LEVEL SECURITY;

-- Organizations
CREATE POLICY "Members view org" ON organizations FOR SELECT USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Auth create org" ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Org admin update" ON organizations FOR UPDATE USING (public.is_org_admin(id));

-- Organization members
CREATE POLICY "Members view org members" ON organization_members FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Org admin add members" ON organization_members FOR INSERT WITH CHECK (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Org admin update members" ON organization_members FOR UPDATE USING (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Org admin delete members" ON organization_members FOR DELETE USING (public.is_org_admin_or_manager(organization_id));

-- Categories
CREATE POLICY "Categories select" ON categories FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Categories insert" ON categories FOR INSERT WITH CHECK (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Categories update" ON categories FOR UPDATE USING (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Categories delete" ON categories FOR DELETE USING (public.is_org_admin_or_manager(organization_id));

-- Products
CREATE POLICY "Products select" ON products FOR SELECT USING (
  is_active = true OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "Products insert" ON products FOR INSERT WITH CHECK (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Products update" ON products FOR UPDATE USING (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Products delete" ON products FOR DELETE USING (public.is_org_admin_or_manager(organization_id));

-- User profiles
CREATE POLICY "Users view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users insert profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users update profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL OR public.is_admin(auth.uid()));

-- Cart items
CREATE POLICY "Cart select" ON cart_items FOR SELECT USING (auth.uid() = user_id AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Cart insert" ON cart_items FOR INSERT WITH CHECK (auth.uid() = user_id AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Cart update" ON cart_items FOR UPDATE USING (auth.uid() = user_id AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Cart delete" ON cart_items FOR DELETE USING (auth.uid() = user_id AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- Orders
CREATE POLICY "Orders select" ON orders FOR SELECT USING (
  auth.uid() = user_id OR user_id IS NULL OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);
CREATE POLICY "Orders insert" ON orders FOR INSERT WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "Orders update" ON orders FOR UPDATE USING (
  auth.uid() = user_id OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Order items
CREATE POLICY "Order items select" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (
    o.user_id = auth.uid() OR o.user_id IS NULL OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  ))
);
CREATE POLICY "Order items insert" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR o.user_id IS NULL OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())))
);

-- Suppliers, Branches, Customers, etc. (multi-tenant)
CREATE POLICY "Suppliers select" ON suppliers FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Suppliers insert" ON suppliers FOR INSERT WITH CHECK (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Suppliers update" ON suppliers FOR UPDATE USING (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Suppliers delete" ON suppliers FOR DELETE USING (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Branches select" ON branches FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Branches insert" ON branches FOR INSERT WITH CHECK (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Branches update" ON branches FOR UPDATE USING (public.is_org_admin_or_manager(organization_id));
CREATE POLICY "Branches delete" ON branches FOR DELETE USING (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Customers select" ON customers FOR SELECT USING (
  auth.uid() = user_id OR (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()) AND (public.has_org_permission(organization_id, 'customers:view') OR public.is_org_admin(organization_id)))
);
CREATE POLICY "Customers insert" ON customers FOR INSERT WITH CHECK (
  (user_id IS NULL AND full_name IS NOT NULL AND phone IS NOT NULL) OR public.is_org_admin_or_manager(organization_id) OR public.has_org_permission(organization_id, 'customers:create')
);
CREATE POLICY "Customers update" ON customers FOR UPDATE USING (public.is_org_admin_or_manager(organization_id) OR public.has_org_permission(organization_id, 'customers:edit'));
CREATE POLICY "Customers delete" ON customers FOR DELETE USING (public.is_org_admin_or_manager(organization_id) OR public.has_org_permission(organization_id, 'customers:delete'));

-- Product variants, images, barcodes (via product)
CREATE POLICY "Variants select" ON product_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND (p.is_active = true OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())))
);
CREATE POLICY "Variants insert" ON product_variants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND public.is_org_admin_or_manager(p.organization_id))
);
CREATE POLICY "Variants update" ON product_variants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND public.is_org_admin_or_manager(p.organization_id))
);
CREATE POLICY "Variants delete" ON product_variants FOR DELETE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND public.is_org_admin_or_manager(p.organization_id))
);

CREATE POLICY "Product images select" ON product_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND (p.is_active = true OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())))
);
CREATE POLICY "Product images insert" ON product_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND public.is_org_admin_or_manager(p.organization_id))
);
CREATE POLICY "Product images update" ON product_images FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND public.is_org_admin_or_manager(p.organization_id))
);
CREATE POLICY "Product images delete" ON product_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND public.is_org_admin_or_manager(p.organization_id))
);

CREATE POLICY "Product barcodes select" ON product_barcodes FOR SELECT USING (
  COALESCE((SELECT p.organization_id FROM products p WHERE p.id = product_barcodes.product_id), (SELECT p.organization_id FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id))
  IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "Product barcodes insert" ON product_barcodes FOR INSERT WITH CHECK (
  (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_barcodes.product_id AND public.is_org_admin_or_manager(p.organization_id)))
  OR (variant_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id AND public.is_org_admin_or_manager(p.organization_id)))
);
CREATE POLICY "Product barcodes update" ON product_barcodes FOR UPDATE USING (
  (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_barcodes.product_id AND public.is_org_admin_or_manager(p.organization_id)))
  OR (variant_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id AND public.is_org_admin_or_manager(p.organization_id)))
);
CREATE POLICY "Product barcodes delete" ON product_barcodes FOR DELETE USING (
  (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_barcodes.product_id AND public.is_org_admin_or_manager(p.organization_id)))
  OR (variant_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id AND public.is_org_admin_or_manager(p.organization_id)))
);

-- Product suppliers, branch inventory, cash, etc.
CREATE POLICY "Product suppliers select" ON product_suppliers FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Product suppliers insert" ON product_suppliers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND public.is_org_admin_or_manager(p.organization_id))
);
CREATE POLICY "Product suppliers update" ON product_suppliers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND public.is_org_admin_or_manager(p.organization_id))
);
CREATE POLICY "Product suppliers delete" ON product_suppliers FOR DELETE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_suppliers.product_id AND public.is_org_admin_or_manager(p.organization_id))
);

CREATE POLICY "Branch inventory select" ON branch_inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = branch_inventory.branch_id AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Branch inventory insert" ON branch_inventory FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = branch_inventory.branch_id AND public.is_org_admin_or_manager(b.organization_id))
);
CREATE POLICY "Branch inventory update" ON branch_inventory FOR UPDATE USING (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = branch_inventory.branch_id AND public.is_org_admin_or_manager(b.organization_id))
);
CREATE POLICY "Branch inventory delete" ON branch_inventory FOR DELETE USING (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = branch_inventory.branch_id AND public.is_org_admin_or_manager(b.organization_id))
);

CREATE POLICY "Cash sessions select" ON cash_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = cash_sessions.branch_id AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Cash sessions insert" ON cash_sessions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = cash_sessions.branch_id AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Cash sessions update" ON cash_sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = cash_sessions.branch_id AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);

CREATE POLICY "Order payments select" ON order_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_payments.order_id AND (o.user_id = auth.uid() OR o.user_id IS NULL OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())))
);
CREATE POLICY "Order payments insert" ON order_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_payments.order_id AND o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);

CREATE POLICY "Audit logs select" ON audit_logs FOR SELECT USING (
  organization_id IS NULL OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);
CREATE POLICY "Audit logs insert" ON audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Inventory movements select" ON inventory_movements FOR SELECT USING (
  EXISTS (SELECT 1 FROM branch_inventory bi JOIN branches b ON b.id = bi.branch_id WHERE bi.id = inventory_movements.branch_inventory_id AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Inventory movements insert" ON inventory_movements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM branch_inventory bi JOIN branches b ON b.id = bi.branch_id WHERE bi.id = inventory_movements.branch_inventory_id AND public.is_org_admin_or_manager(b.organization_id))
);

CREATE POLICY "Inventory transfers select" ON inventory_transfers FOR SELECT USING (
  from_branch_id IN (SELECT id FROM branches WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  OR to_branch_id IN (SELECT id FROM branches WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Inventory transfers insert" ON inventory_transfers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = inventory_transfers.from_branch_id AND public.is_org_admin_or_manager(b.organization_id))
);
CREATE POLICY "Inventory transfers update" ON inventory_transfers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM branches b WHERE b.id = inventory_transfers.from_branch_id AND public.is_org_admin_or_manager(b.organization_id))
);

-- Roles, permissions (global - todos pueden ver)
CREATE POLICY "Roles select" ON roles FOR SELECT USING (true);
CREATE POLICY "Permissions select" ON permissions FOR SELECT USING (true);
CREATE POLICY "Roles permissions select" ON roles_permissions FOR SELECT USING (true);
CREATE POLICY "User permissions select" ON user_permissions FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "RBAC audit select" ON rbac_audit_log FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "RBAC audit insert" ON rbac_audit_log FOR INSERT WITH CHECK (true);

-- =============================================================================
-- RPC: Poblar inventario faltante (multi-tenant: solo branches y products de misma org)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.populate_missing_inventory_entries_rpc()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_variants_count INTEGER := 0;
BEGIN
  -- Productos sin variantes: crear inventario por branch de la misma org
  INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
  SELECT b.id, p.id, NULL, 0, COALESCE(p.min_stock, 0), COALESCE(p.low_stock_threshold, 10)
  FROM branches b
  JOIN products p ON b.organization_id = p.organization_id
  WHERE b.is_active = true AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory
    WHERE branch_id = b.id AND product_id = p.id AND variant_id IS NULL
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Variantes: crear inventario por branch de la misma org (vía product)
  INSERT INTO branch_inventory (branch_id, product_id, variant_id, stock, min_stock, low_stock_threshold)
  SELECT b.id, NULL, pv.id, 0,
    COALESCE(pv.min_stock, p.min_stock, 0),
    COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 10)
  FROM branches b
  JOIN products p ON p.organization_id = b.organization_id
  JOIN product_variants pv ON pv.product_id = p.id
  WHERE b.is_active = true AND p.is_active = true AND pv.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM branch_inventory
    WHERE branch_id = b.id AND variant_id = pv.id AND product_id IS NULL
  );
  GET DIAGNOSTICS v_variants_count = ROW_COUNT;

  v_count := v_count + v_variants_count;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.populate_missing_inventory_entries_rpc() TO authenticated;
COMMENT ON FUNCTION public.populate_missing_inventory_entries_rpc() IS 'Crea entradas de inventario faltantes. Multi-tenant: solo branches y products de la misma org.';

-- =============================================================================
-- FIN - Schema completo para instalación en blanco
-- =============================================================================
