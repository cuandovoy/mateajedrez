-- Auditoría de cambios en organization_members (agregar, editar rol, eliminar miembros).

-- Extender create_audit_log para aceptar organization_id opcional
CREATE OR REPLACE FUNCTION create_audit_log(
  p_table_name VARCHAR(100),
  p_record_id UUID,
  p_action VARCHAR(50),
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
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
  
  INSERT INTO audit_logs (table_name, record_id, action, user_id, old_data, new_data, changed_fields, notes, organization_id)
  VALUES (p_table_name, p_record_id, p_action, auth.uid(), p_old_data, p_new_data, v_changed_fields, p_notes, p_organization_id)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para organization_members
CREATE OR REPLACE FUNCTION audit_organization_members_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'organization_members',
      NEW.id,
      'INSERT',
      NULL::JSONB,
      to_jsonb(NEW),
      'Miembro agregado a la organización',
      NEW.organization_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'organization_members',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Rol o datos de miembro actualizados',
      NEW.organization_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'organization_members',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL::JSONB,
      'Miembro eliminado de la organización',
      OLD.organization_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_organization_members ON organization_members;
CREATE TRIGGER audit_organization_members
  AFTER INSERT OR UPDATE OR DELETE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION audit_organization_members_trigger();
