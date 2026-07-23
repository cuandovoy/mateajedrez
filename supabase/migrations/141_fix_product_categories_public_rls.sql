-- Migration: 141_fix_product_categories_public_rls.sql
-- Permite SELECT anónimo en product_categories para la tienda pública.
-- El problema: la política de 117 solo permitía acceso a miembros de la org,
-- bloqueando a visitantes sin auth. Productos vinculados a una categoría SOLO
-- vía esta tabla de junction (no por category_id directo) no aparecían en la
-- tienda pública para usuarios anónimos. Mismo patrón que 097 para categories.

DROP POLICY IF EXISTS "org_members_select_product_categories" ON product_categories;

CREATE POLICY "Product categories select public or org member"
  ON product_categories FOR SELECT
  USING (
    auth.uid() IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
