-- Create customers table to manage all customers (registered and guest)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  address JSONB,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on phone for faster lookups
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_email ON customers(email);

-- Add customer_id to orders table (rename existing user_id to guest_user_id for backwards compatibility)
ALTER TABLE orders ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT;

-- Create index for faster order lookups by customer
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Update timestamp trigger for customers table
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customers can view their own data
CREATE POLICY customers_select_own ON customers
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- RLS Policy: Admins and users with customers:view can view all customers
CREATE POLICY customers_select_admin ON customers
  FOR SELECT
  USING (
    (SELECT COUNT(*) FROM user_all_permissions 
     WHERE user_id = auth.uid() AND permission_key = 'customers:view') > 0
    OR
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- RLS Policy: Only admins and users with customers:create can insert
CREATE POLICY customers_insert_admin ON customers
  FOR INSERT
  WITH CHECK (
    (SELECT COUNT(*) FROM user_all_permissions 
     WHERE user_id = auth.uid() AND permission_key = 'customers:create') > 0
    OR
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- RLS Policy: Allow guest checkout to create customers (used by service role)
CREATE POLICY customers_insert_guest ON customers
  FOR INSERT
  WITH CHECK (
    user_id IS NULL AND full_name IS NOT NULL AND phone IS NOT NULL
  );

-- RLS Policy: Only admins and users with customers:edit can update
CREATE POLICY customers_update_admin ON customers
  FOR UPDATE
  USING (
    (SELECT COUNT(*) FROM user_all_permissions 
     WHERE user_id = auth.uid() AND permission_key = 'customers:edit') > 0
    OR
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- RLS Policy: Only admins and users with customers:delete can delete
CREATE POLICY customers_delete_admin ON customers
  FOR DELETE
  USING (
    (SELECT COUNT(*) FROM user_all_permissions 
     WHERE user_id = auth.uid() AND permission_key = 'customers:delete') > 0
    OR
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- Add permissions for customer management (if permission system exists)
-- These will be added to the permissions table
INSERT INTO permissions (key, name, description, category)
VALUES 
  ('customers:view', 'Ver clientes', 'Permite ver la lista de clientes', 'customers'),
  ('customers:create', 'Crear clientes', 'Permite crear nuevos clientes', 'customers'),
  ('customers:edit', 'Editar clientes', 'Permite editar información de clientes', 'customers'),
  ('customers:delete', 'Eliminar clientes', 'Permite eliminar clientes', 'customers'),
  ('customers:export', 'Exportar clientes', 'Permite exportar datos de clientes', 'customers')
ON CONFLICT (key) DO NOTHING;

-- Assign customer permissions to manager and admin roles
-- Admin role gets all permissions
INSERT INTO roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('admin', 'manager')
  AND p.key LIKE 'customers:%'
  AND NOT EXISTS (
    SELECT 1 FROM roles_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
