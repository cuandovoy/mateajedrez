-- Recreate get_audit_logs RPC for PostgREST schema cache compatibility
-- and add explicit organization scoping.

CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_table_name VARCHAR(100) DEFAULT NULL,
  p_action VARCHAR(50) DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_organization_id UUID DEFAULT NULL
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
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 OR p_limit > 500 THEN
    RAISE EXCEPTION 'p_limit inválido (1..500)';
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset inválido';
  END IF;

  IF p_organization_id IS NOT NULL AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.user_id,
    au.email::TEXT AS user_email,
    al.old_data,
    al.new_data,
    al.changed_fields,
    al.notes,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN auth.users au ON al.user_id = au.id
  WHERE
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_record_id IS NULL OR al.record_id = p_record_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    AND (
      p_organization_id IS NULL
      OR al.organization_id = p_organization_id
    )
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_logs(VARCHAR, VARCHAR, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, UUID)
TO authenticated;

COMMENT ON FUNCTION public.get_audit_logs(VARCHAR, VARCHAR, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, UUID)
IS 'Devuelve logs de auditoría con filtros y paginación. Soporta alcance por organización.';
