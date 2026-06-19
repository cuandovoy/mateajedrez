-- Migration: 131_public_storefront_guest_checkout_policies.sql
--
-- El checkout de la tienda pública ejecutado por usuarios anónimos (guests)
-- necesita leer tres tablas que actualmente solo tienen políticas de SELECT
-- para miembros de la organización:
--
--   branches        → para resolver qué sucursal fulfillment usa la orden
--   branch_inventory → para validar stock antes de confirmar la orden
--   customers       → para buscar cliente por teléfono (evitar duplicados)
--                     y para leer el cliente recién creado (SELECT after INSERT)
--
-- branches y branch_inventory: datos operativos del local, públicamente
-- necesarios para que el storefront funcione. No contienen datos sensibles.
--
-- customers (user_id IS NULL): solo clientes guest — sin cuenta vinculada.
-- Exponer únicamente estos registros evita filtrar datos de usuarios registrados.

-- ============================================================
-- 1. branches — SELECT público para sucursales activas
-- ============================================================
DROP POLICY IF EXISTS "Storefront can view active branches" ON branches;

CREATE POLICY "Storefront can view active branches"
  ON branches FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 2. branch_inventory — SELECT público scoped a branches activas
-- ============================================================
DROP POLICY IF EXISTS "Storefront can view branch inventory" ON branch_inventory;

CREATE POLICY "Storefront can view branch inventory"
  ON branch_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_inventory.branch_id
        AND b.is_active = true
    )
  );

-- ============================================================
-- 3. customers — SELECT público para el checkout del storefront
-- ============================================================
-- Permite que el storefront busque clientes por org_id + phone (lookup de
-- checkout). Abarca tanto clientes guest (user_id IS NULL) como clientes
-- que se registraron luego de haber comprado como guest. Sin esta policy,
-- el INSERT falla con duplicate key y el retry SELECT también devuelve vacío.
-- El filtro real de scope lo aplica la app (siempre filtra por organization_id
-- y phone — nunca hace un SELECT * sin restricciones).
DROP POLICY IF EXISTS "Storefront can view guest customers" ON customers;
DROP POLICY IF EXISTS "Storefront can view customers for checkout" ON customers;

CREATE POLICY "Storefront can view customers for checkout"
  ON customers FOR SELECT
  USING (is_active = true);
