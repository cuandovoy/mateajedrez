-- Solo el admin global (user_profiles.role = 'admin') puede crear organizaciones.
-- Excepción: usuarios sin ninguna org pueden crear su primera (bootstrap).

CREATE OR REPLACE FUNCTION public.can_create_organization()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL
    AND (
      -- Rol admin en user_profiles (admin global)
      EXISTS (
        SELECT 1 FROM public.user_profiles
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
