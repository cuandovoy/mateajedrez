-- Migration: 129_public_storefront_payment_methods_select.sql
--
-- La política SELECT de organization_payment_methods requería ser miembro
-- de la org, lo que bloqueaba la lectura para compradores guest y usuarios
-- no-admin en la tienda pública. El storefront necesita leer los métodos
-- activos para mostrarlos en el checkout.

CREATE POLICY "Storefront can view active payment methods"
  ON organization_payment_methods FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (
      SELECT id FROM organizations WHERE is_active = true
    )
  );
