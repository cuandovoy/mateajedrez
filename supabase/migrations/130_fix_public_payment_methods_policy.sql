-- Migration: 130_fix_public_payment_methods_policy.sql
--
-- La policy 129 usaba una subquery a la tabla organizations para verificar
-- que la org esté activa. Esa tabla tiene RLS restrictiva para usuarios
-- anónimos, por lo que la subquery devuelve vacío y la policy nunca se cumple
-- en sesión de guest (los métodos de pago desaparecen al cerrar sesión).
--
-- Fix: reemplazar por USING (is_active = true) sin subquery. El filtro de
-- organization_id ya lo aplica la query de la aplicación via PostgREST.

DROP POLICY IF EXISTS "Storefront can view active payment methods" ON organization_payment_methods;

CREATE POLICY "Storefront can view active payment methods"
  ON organization_payment_methods FOR SELECT
  USING (is_active = true);
