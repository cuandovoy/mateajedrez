-- Add RBAC (Role-Based Access Control) System
-- Migration: 029_add_rbac_system.sql
-- This migration adds comprehensive role and permission management

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Junction table: roles_permissions
CREATE TABLE IF NOT EXISTS roles_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(role_id, permission_id)
);

-- 4. User individual permissions (for exceptions/temporary access)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  UNIQUE(user_id, permission_id)
);

-- 5. Audit log for RBAC changes
CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insert default roles
INSERT INTO roles (key, name, description, is_system, created_by) VALUES
  ('admin', 'Administrador', 'Acceso completo al sistema', true, NULL),
  ('manager', 'Gerente', 'Gestión de productos, órdenes y caja', true, NULL),
  ('viewer', 'Visualizador', 'Solo lectura de productos y órdenes', true, NULL),
  ('user', 'Usuario', 'Usuario regular de tienda', true, NULL)
ON CONFLICT (key) DO NOTHING;

-- 7. Insert default permissions
INSERT INTO permissions (key, name, description, category, created_by) VALUES
  -- Products
  ('products:view', 'Ver productos', 'Visualizar lista y detalles de productos', 'products', NULL),
  ('products:create', 'Crear productos', 'Crear nuevos productos', 'products', NULL),
  ('products:edit', 'Editar productos', 'Modificar productos existentes', 'products', NULL),
  ('products:delete', 'Eliminar productos', 'Eliminar productos', 'products', NULL),
  ('products:manage_stock', 'Gestionar stock', 'Actualizar inventario', 'products', NULL),
  
  -- Categories
  ('categories:view', 'Ver categorías', 'Visualizar categorías', 'categories', NULL),
  ('categories:create', 'Crear categorías', 'Crear nuevas categorías', 'categories', NULL),
  ('categories:edit', 'Editar categorías', 'Modificar categorías', 'categories', NULL),
  ('categories:delete', 'Eliminar categorías', 'Eliminar categorías', 'categories', NULL),
  
  -- Orders
  ('orders:view', 'Ver órdenes', 'Visualizar lista de órdenes', 'orders', NULL),
  ('orders:view_own', 'Ver órdenes propias', 'Visualizar solo órdenes del usuario', 'orders', NULL),
  ('orders:edit', 'Editar órdenes', 'Modificar estado y detalles de órdenes', 'orders', NULL),
  ('orders:delete', 'Eliminar órdenes', 'Eliminar órdenes', 'orders', NULL),
  
  -- Users
  ('users:view', 'Ver usuarios', 'Visualizar lista de usuarios', 'users', NULL),
  ('users:edit', 'Editar usuarios', 'Modificar datos de usuarios', 'users', NULL),
  ('users:manage_roles', 'Gestionar roles', 'Asignar roles a usuarios', 'users', NULL),
  ('users:delete', 'Eliminar usuarios', 'Eliminar cuentas de usuario', 'users', NULL),
  
  -- Cash Register
  ('cash_register:access', 'Acceso a caja', 'Usar sistema de caja registradora', 'cash_register', NULL),
  ('cash_register:view_sessions', 'Ver sesiones de caja', 'Visualizar historial de sesiones', 'cash_register', NULL),
  ('cash_register:close_session', 'Cerrar sesión', 'Cerrar sesión de caja', 'cash_register', NULL),
  
  -- Inventory
  ('inventory:view', 'Ver inventario', 'Visualizar inventario por sucursal', 'inventory', NULL),
  ('inventory:manage', 'Gestionar inventario', 'Transferencias y movimientos de stock', 'inventory', NULL),
  
  -- Reports
  ('reports:view', 'Ver reportes', 'Visualizar reportes de ventas', 'reports', NULL),
  ('reports:export', 'Exportar reportes', 'Descargar reportes en formatos', 'reports', NULL),
  
  -- Settings
  ('settings:manage', 'Gestionar configuración', 'Acceso a configuración del sistema', 'settings', NULL),
  ('settings:manage_roles', 'Gestionar roles y permisos', 'Crear y modificar roles', 'settings', NULL),
  ('settings:audit_logs', 'Ver logs de auditoría', 'Visualizar auditoría del sistema', 'settings', NULL)
ON CONFLICT (key) DO NOTHING;

-- 8. Assign permissions to roles
-- Admin: All permissions
INSERT INTO roles_permissions (role_id, permission_id, created_by)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- Manager: Products, Orders, Cash Register, Inventory (partial)
INSERT INTO roles_permissions (role_id, permission_id, created_by)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.key = 'manager'
AND p.category IN ('products', 'categories', 'orders', 'cash_register', 'inventory', 'reports')
AND p.key NOT IN (
  'products:delete', 'categories:delete', 'orders:delete',
  'users:manage_roles', 'users:delete',
  'settings:manage', 'settings:manage_roles', 'settings:audit_logs'
)
ON CONFLICT DO NOTHING;

-- Viewer: Read-only access
INSERT INTO roles_permissions (role_id, permission_id, created_by)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.key = 'viewer'
AND p.key IN (
  'products:view', 'categories:view', 'orders:view',
  'inventory:view', 'reports:view'
)
ON CONFLICT DO NOTHING;

-- User: Limited permissions
INSERT INTO roles_permissions (role_id, permission_id, created_by)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.key = 'user'
AND p.key IN (
  'products:view', 'categories:view', 'orders:view_own'
)
ON CONFLICT DO NOTHING;

-- 9. Update user_profiles to support new role enum
-- First add new roles to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_permissions_role_id ON roles_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_permissions_permission_id ON roles_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON user_permissions(expires_at);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_changed_by ON rbac_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_log_changed_at ON rbac_audit_log(changed_at);

-- 11. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roles_update_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- 12. Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_log ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies for roles table
CREATE POLICY "Everyone can view roles"
  ON roles FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update roles"
  ON roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 14. RLS Policies for permissions table
CREATE POLICY "Everyone can view permissions"
  ON permissions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage permissions"
  ON permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 15. RLS Policies for roles_permissions table
CREATE POLICY "Everyone can view roles_permissions"
  ON roles_permissions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage roles_permissions"
  ON roles_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 16. RLS Policies for user_permissions table
CREATE POLICY "Users can view their own permissions"
  ON user_permissions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage user_permissions"
  ON user_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- 17. RLS Policies for rbac_audit_log table
CREATE POLICY "Only admins can view audit logs"
  ON rbac_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "System can write audit logs"
  ON rbac_audit_log FOR INSERT
  WITH CHECK (true);

-- 18. Create function to log RBAC changes
CREATE OR REPLACE FUNCTION log_rbac_change(
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_old_data JSONB,
  p_new_data JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO rbac_audit_log (action, entity_type, entity_id, old_data, new_data, changed_by)
  VALUES (p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, auth.uid());
END;
$$ LANGUAGE plpgsql;

-- 19. Create view for user permissions with role inheritance
CREATE OR REPLACE VIEW user_all_permissions AS
SELECT DISTINCT
  up.user_id,
  p.id as permission_id,
  p.key as permission_key,
  p.name as permission_name,
  p.category as permission_category,
  'role' as source,
  NULL::TIMESTAMP as expires_at
FROM user_profiles up
JOIN roles r ON up.role::VARCHAR = r.key
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
WHERE upl.expires_at IS NULL OR upl.expires_at > NOW();
