-- Fix: permitir eliminar cobros de órdenes a admin/manager de la organización.
-- Sin esta policy, el delete desde AdminOrderDetail falla por RLS.

DROP POLICY IF EXISTS "Order payments delete via order org admin" ON order_payments;
DROP POLICY IF EXISTS "Order payments delete via order" ON order_payments;
DROP POLICY IF EXISTS "Order payments delete" ON order_payments;

CREATE POLICY "Order payments delete via order org admin"
  ON order_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id = order_payments.order_id
        AND o.organization_id IN (
          SELECT organization_id
          FROM organization_members
          WHERE user_id = auth.uid()
            AND role IN ('admin', 'manager')
        )
    )
  );

COMMENT ON POLICY "Order payments delete via order org admin" ON order_payments
IS 'Permite eliminar cobros solo a admin/manager de la organización dueña de la orden.';
