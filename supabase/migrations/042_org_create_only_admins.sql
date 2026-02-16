-- Solo admins pueden crear organizaciones.
-- Excepción: usuarios sin ninguna org pueden crear su primera (bootstrap).

CREATE OR REPLACE FUNCTION public.can_create_organization()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL
    AND (
      -- Es admin en al menos una org
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR
      -- No tiene orgs (primera vez / bootstrap)
      NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Auth create org" ON organizations;

CREATE POLICY "Auth create org" ON organizations
  FOR INSERT
  WITH CHECK (public.can_create_organization());
