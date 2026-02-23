-- Política de INSERT en organizations en línea (sin función), para evitar 42501.
-- Solo admin en user_profiles o usuario sin orgs (bootstrap) puede crear.

DROP POLICY IF EXISTS "Auth create org" ON organizations;

CREATE POLICY "Auth create org" ON organizations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Admin global (user_profiles.role = 'admin')
      (SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
      OR
      -- Bootstrap: no tiene ninguna org
      NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid())
    )
  );

-- Función de diagnóstico: ejecutar como el usuario autenticado o desde SQL Editor
-- para ver por qué can_create_organization falla.
-- SELECT * FROM debug_can_create_org();
CREATE OR REPLACE FUNCTION public.debug_can_create_org()
RETURNS TABLE(
  uid UUID,
  has_profile BOOLEAN,
  profile_role TEXT,
  is_admin_role BOOLEAN,
  org_count BIGINT,
  can_bootstrap BOOLEAN,
  would_allow_insert BOOLEAN
) AS $$
  SELECT
    auth.uid(),
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid()),
    (SELECT role::TEXT FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1),
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1) = 'admin',
    (SELECT COUNT(*) FROM public.organization_members WHERE user_id = auth.uid()),
    NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()),
    (
      auth.uid() IS NOT NULL
      AND (
        (SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
        OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid())
      )
    );
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;
