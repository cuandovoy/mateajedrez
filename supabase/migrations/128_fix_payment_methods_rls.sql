-- Migration: 128_fix_payment_methods_rls.sql
--
-- La política FOR ALL de organization_payment_methods usaba is_org_admin()
-- que requiere role = 'admin' exacto. El resto del proyecto usa
-- is_org_admin_or_manager() (admin OR manager). Esto causaba que usuarios
-- con role 'manager' pudieran ver los métodos (SELECT pasaba) pero no
-- editarlos (UPDATE fallaba silenciosamente, 0 filas afectadas).

DROP POLICY IF EXISTS "Org admins can manage payment methods" ON organization_payment_methods;

CREATE POLICY "Org admins can manage payment methods"
  ON organization_payment_methods FOR ALL
  USING (public.is_org_admin_or_manager(organization_id))
  WITH CHECK (public.is_org_admin_or_manager(organization_id));
