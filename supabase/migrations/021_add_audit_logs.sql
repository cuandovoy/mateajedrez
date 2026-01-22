-- Create audit logs system
-- This migration creates a comprehensive audit logging system to track all important operations

-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SELECT' (for sensitive reads)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Create index for common queries (table + action + date)
CREATE INDEX idx_audit_logs_table_action_date ON audit_logs(table_name, action, created_at DESC);

-- Function to create audit log entry
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
  v_user_id UUID;
  v_changed_fields TEXT[];
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Calculate changed fields for UPDATE actions
  IF p_action = 'UPDATE' AND p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
    SELECT ARRAY_AGG(key)
    INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(p_new_data)
      WHERE (p_old_data->>key) IS DISTINCT FROM (p_new_data->>key)
    ) AS changed;
  END IF;
  
  -- Insert audit log
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    old_data,
    new_data,
    changed_fields,
    notes
  )
  VALUES (
    p_table_name,
    p_record_id,
    p_action,
    v_user_id,
    p_old_data,
    p_new_data,
    v_changed_fields,
    p_notes
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic trigger function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    PERFORM create_audit_log(
      TG_TABLE_NAME::VARCHAR(100),
      (OLD.id)::UUID,
      'DELETE'::VARCHAR(50),
      v_old_data,
      NULL::JSONB,
      NULL::TEXT
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    PERFORM create_audit_log(
      TG_TABLE_NAME::VARCHAR(100),
      (NEW.id)::UUID,
      'UPDATE'::VARCHAR(50),
      v_old_data,
      v_new_data,
      NULL::TEXT
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    PERFORM create_audit_log(
      TG_TABLE_NAME::VARCHAR(100),
      (NEW.id)::UUID,
      'INSERT'::VARCHAR(50),
      NULL::JSONB,
      v_new_data,
      NULL::TEXT
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for important tables

-- Products
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Categories
CREATE TRIGGER audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Product Variants
CREATE TRIGGER audit_product_variants
  AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Branch Inventory (stock changes)
CREATE TRIGGER audit_branch_inventory
  AFTER INSERT OR UPDATE OR DELETE ON branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Orders
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Cash Sessions
CREATE TRIGGER audit_cash_sessions
  AFTER INSERT OR UPDATE OR DELETE ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Order Payments
CREATE TRIGGER audit_order_payments
  AFTER INSERT OR UPDATE OR DELETE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Suppliers
CREATE TRIGGER audit_suppliers
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Branches
CREATE TRIGGER audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- User Profiles (role changes, etc.)
CREATE TRIGGER audit_user_profiles
  AFTER INSERT OR UPDATE OR DELETE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- RLS Policies for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Only system can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
CREATE POLICY "No one can update audit logs"
  ON audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete audit logs"
  ON audit_logs FOR DELETE
  USING (false);

-- Function to get audit logs with user information
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_table_name VARCHAR(100) DEFAULT NULL,
  p_action VARCHAR(50) DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  table_name VARCHAR(100),
  record_id UUID,
  action VARCHAR(50),
  user_id UUID,
  user_email TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.user_id,
    au.email::TEXT as user_email,
    al.old_data,
    al.new_data,
    al.changed_fields,
    al.notes,
    al.created_at
  FROM audit_logs al
  LEFT JOIN auth.users au ON al.user_id = au.id
  WHERE
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_record_id IS NULL OR al.record_id = p_record_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit summary (counts by action and table)
CREATE OR REPLACE FUNCTION get_audit_summary(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  table_name VARCHAR(100),
  action VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.table_name,
    al.action,
    COUNT(*)::BIGINT as count
  FROM audit_logs al
  WHERE
    (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  GROUP BY al.table_name, al.action
  ORDER BY al.table_name, al.action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE audit_logs IS 'Sistema de auditoría para registrar todos los movimientos importantes del sistema';
COMMENT ON COLUMN audit_logs.table_name IS 'Nombre de la tabla afectada';
COMMENT ON COLUMN audit_logs.record_id IS 'ID del registro afectado';
COMMENT ON COLUMN audit_logs.action IS 'Acción realizada: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN audit_logs.old_data IS 'Datos anteriores (para UPDATE/DELETE)';
COMMENT ON COLUMN audit_logs.new_data IS 'Datos nuevos (para INSERT/UPDATE)';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Campos que cambiaron (solo para UPDATE)';
