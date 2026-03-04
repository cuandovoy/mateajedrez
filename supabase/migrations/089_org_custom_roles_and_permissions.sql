-- Roles por organización (híbrido):
-- - Mantiene catálogo global roles/permissions
-- - Agrega roles custom por organización
-- - Permite asignar permisos por rol de organización
-- - Actualiza helpers de autorización para resolver permisos por org role

CREATE TABLE IF NOT EXISTS public.organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  base_role_key VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (base_role_key IN ('admin', 'manager', 'viewer', 'user', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, key),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_roles_org_active
  ON public.organization_roles(organization_id, is_active);

CREATE TABLE IF NOT EXISTS public.organization_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_role_id UUID NOT NULL REFERENCES public.organization_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_org_role_permissions_role
  ON public.organization_role_permissions(organization_role_id);

CREATE INDEX IF NOT EXISTS idx_org_role_permissions_permission
  ON public.organization_role_permissions(permission_id);

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS organization_role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_members_org_role_id_fkey'
  ) THEN
    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_org_role_id_fkey
      FOREIGN KEY (organization_role_id)
      REFERENCES public.organization_roles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_members_org_role
  ON public.organization_members(organization_id, organization_role_id);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_roles_touch_updated_at ON public.organization_roles;
CREATE TRIGGER trg_org_roles_touch_updated_at
BEFORE UPDATE ON public.organization_roles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- Backfill de roles por organización a partir de organization_members.role
INSERT INTO public.organization_roles (
  organization_id,
  key,
  name,
  description,
  is_system,
  base_role_key,
  is_active,
  created_by
)
SELECT DISTINCT
  om.organization_id,
  om.role AS key,
  CASE om.role
    WHEN 'admin' THEN 'Administrador'
    WHEN 'manager' THEN 'Gerente'
    WHEN 'viewer' THEN 'Visualizador'
    WHEN 'user' THEN 'Usuario'
    ELSE INITCAP(om.role)
  END AS name,
  CASE om.role
    WHEN 'admin' THEN 'Rol base de administración de la organización'
    WHEN 'manager' THEN 'Rol base de gestión operativa'
    WHEN 'viewer' THEN 'Rol base de solo lectura'
    WHEN 'user' THEN 'Rol base de usuario'
    ELSE 'Rol migrado automáticamente desde organization_members.role'
  END AS description,
  (om.role IN ('admin', 'manager', 'viewer', 'user')) AS is_system,
  CASE
    WHEN om.role IN ('admin', 'manager', 'viewer', 'user') THEN om.role
    ELSE 'custom'
  END AS base_role_key,
  TRUE,
  NULL::UUID
FROM public.organization_members om
WHERE om.organization_id IS NOT NULL
  AND om.role IS NOT NULL
ON CONFLICT (organization_id, key) DO NOTHING;

-- Backfill permisos de roles base globales hacia organization_roles
INSERT INTO public.organization_role_permissions (organization_role_id, permission_id, created_by)
SELECT
  orr.id,
  rp.permission_id,
  NULL::UUID
FROM public.organization_roles orr
JOIN public.roles r ON r.key = orr.base_role_key
JOIN public.roles_permissions rp ON rp.role_id = r.id
WHERE orr.base_role_key IN ('admin', 'manager', 'viewer', 'user')
ON CONFLICT (organization_role_id, permission_id) DO NOTHING;

-- Vincular miembros al role_id de su organización
UPDATE public.organization_members om
SET organization_role_id = orr.id
FROM public.organization_roles orr
WHERE om.organization_role_id IS NULL
  AND orr.organization_id = om.organization_id
  AND orr.key = om.role;

ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org roles select" ON public.organization_roles;
CREATE POLICY "Org roles select"
  ON public.organization_roles FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org roles mutate" ON public.organization_roles;
CREATE POLICY "Org roles mutate"
  ON public.organization_roles FOR ALL
  USING (public.is_org_admin_or_manager(organization_id))
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

DROP POLICY IF EXISTS "Org role permissions select" ON public.organization_role_permissions;
CREATE POLICY "Org role permissions select"
  ON public.organization_role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_roles orr
      WHERE orr.id = organization_role_permissions.organization_role_id
        AND public.is_org_member(orr.organization_id)
    )
  );

DROP POLICY IF EXISTS "Org role permissions mutate" ON public.organization_role_permissions;
CREATE POLICY "Org role permissions mutate"
  ON public.organization_role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_roles orr
      WHERE orr.id = organization_role_permissions.organization_role_id
        AND public.is_org_admin_or_manager(orr.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_roles orr
      WHERE orr.id = organization_role_permissions.organization_role_id
        AND public.is_org_admin_or_manager(orr.organization_id)
    )
  );

-- View para permisos efectivos del usuario (global + custom org roles)
CREATE OR REPLACE VIEW public.user_all_permissions AS
SELECT DISTINCT
  om.user_id,
  p.id AS permission_id,
  p.key AS permission_key,
  p.name AS permission_name,
  p.category AS permission_category,
  'org_role'::TEXT AS source,
  NULL::TIMESTAMPTZ AS expires_at
FROM public.organization_members om
JOIN public.organization_roles orr
  ON orr.id = om.organization_role_id
 AND orr.organization_id = om.organization_id
 AND COALESCE(orr.is_active, TRUE)
JOIN public.organization_role_permissions orp
  ON orp.organization_role_id = orr.id
JOIN public.permissions p
  ON p.id = orp.permission_id
UNION ALL
SELECT DISTINCT
  om.user_id,
  p.id AS permission_id,
  p.key AS permission_key,
  p.name AS permission_name,
  p.category AS permission_category,
  'legacy_role'::TEXT AS source,
  NULL::TIMESTAMPTZ AS expires_at
FROM public.organization_members om
JOIN public.roles r ON r.key = om.role
JOIN public.roles_permissions rp ON rp.role_id = r.id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE om.organization_role_id IS NULL
UNION ALL
SELECT
  upl.user_id,
  p.id AS permission_id,
  p.key AS permission_key,
  p.name AS permission_name,
  p.category AS permission_category,
  'user'::TEXT AS source,
  upl.expires_at
FROM public.user_permissions upl
JOIN public.permissions p ON p.id = upl.permission_id
WHERE (upl.expires_at IS NULL OR upl.expires_at > NOW());

-- Helpers de autorización por organización
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.organization_roles orr
      ON orr.id = om.organization_role_id
     AND orr.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND COALESCE(orr.base_role_key, om.role) IN ('admin', 'manager')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.organization_roles orr
      ON orr.id = om.organization_role_id
     AND orr.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND COALESCE(orr.base_role_key, om.role) = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.organization_roles orr
      ON orr.id = om.organization_role_id
     AND orr.organization_id = om.organization_id
     AND COALESCE(orr.is_active, TRUE)
    LEFT JOIN public.organization_role_permissions orp
      ON orp.organization_role_id = orr.id
    LEFT JOIN public.permissions p_custom
      ON p_custom.id = orp.permission_id
    LEFT JOIN public.roles r
      ON r.key = om.role
    LEFT JOIN public.roles_permissions rp
      ON rp.role_id = r.id
    LEFT JOIN public.permissions p_legacy
      ON p_legacy.id = rp.permission_id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND (
        p_custom.key = p_permission_key
        OR (om.organization_role_id IS NULL AND p_legacy.key = p_permission_key)
      )
  );
END;
$$;

COMMENT ON TABLE public.organization_roles
IS 'Roles por organización (sistema + custom).';

COMMENT ON TABLE public.organization_role_permissions
IS 'Permisos asignados a roles por organización.';

COMMENT ON COLUMN public.organization_members.organization_role_id
IS 'Rol efectivo del usuario en la organización (custom o sistema clonado a nivel org).';
