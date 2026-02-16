-- Restringir gestión de organization_members a solo admins (no managers)
-- Los managers pueden operar productos, inventario, órdenes, etc., pero NO pueden
-- agregar, editar ni eliminar miembros de la organización.

DROP POLICY IF EXISTS "Org admin add members" ON organization_members;
DROP POLICY IF EXISTS "Org admin update members" ON organization_members;
DROP POLICY IF EXISTS "Org admin delete members" ON organization_members;

CREATE POLICY "Org admin add members" ON organization_members
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Org admin update members" ON organization_members
  FOR UPDATE USING (public.is_org_admin(organization_id));

CREATE POLICY "Org admin delete members" ON organization_members
  FOR DELETE USING (public.is_org_admin(organization_id));
