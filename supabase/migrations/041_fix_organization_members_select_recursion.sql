-- Fix infinite recursion: la política SELECT de organization_members consultaba
-- la misma tabla en su USING, causando recursión. Usar get_user_organization_ids()
-- (SECURITY DEFINER) que bypasea RLS al leer.

DROP POLICY IF EXISTS "Members view org members" ON organization_members;
DROP POLICY IF EXISTS "Members can view org members" ON organization_members;

CREATE POLICY "Members view org members" ON organization_members
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids()));
