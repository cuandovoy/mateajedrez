-- Migration: 097_fix_categories_public_rls.sql
-- Permite SELECT anónimo en categories para la tienda pública.
-- El problema: la política de 037 solo permitía acceso a miembros de la org,
-- bloqueando a visitantes sin auth que navegan la tienda pública.

DROP POLICY IF EXISTS "Categories select by org member" ON categories;

CREATE POLICY "Categories select public or org member"
  ON categories FOR SELECT
  USING (
    auth.uid() IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
