-- Anulación de facturas de proveedor (Opción A: solo si no tiene pagos)
-- - Cambia el estado de la factura a 'cancelled'
-- - Cancela la entrada 'accrual' del expense_ledger asociada
-- - Bloquea si la factura tiene pagos registrados (paid_amount > 0)

CREATE OR REPLACE FUNCTION public.cancel_supplier_invoice(p_supplier_invoice_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice supplier_invoices%ROWTYPE;
BEGIN
  SELECT *
  INTO v_invoice
  FROM supplier_invoices
  WHERE id = p_supplier_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura % no encontrada', p_supplier_invoice_id;
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'La factura ya está anulada';
  END IF;

  IF COALESCE(v_invoice.paid_amount, 0) > 0 THEN
    RAISE EXCEPTION 'La factura tiene pagos registrados. Revertí los pagos antes de anularla.';
  END IF;

  -- Verificar que el usuario pertenece a la organización
  IF NOT public.is_org_member(v_invoice.organization_id) THEN
    RAISE EXCEPTION 'No autorizado para esta organización';
  END IF;

  -- Cancelar la factura
  UPDATE supplier_invoices
  SET status = 'cancelled',
      outstanding_amount = 0,
      updated_at = NOW()
  WHERE id = p_supplier_invoice_id;

  -- Cancelar la entrada accrual del expense_ledger (si existe — no existe para facturas en draft)
  UPDATE expense_ledger
  SET status = 'cancelled'
  WHERE source_table = 'supplier_invoices'
    AND source_id = p_supplier_invoice_id
    AND entry_kind = 'accrual'
    AND status = 'posted';

  RETURN p_supplier_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_supplier_invoice(UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_supplier_invoice(UUID)
IS 'Anula una factura de proveedor y su entrada accrual en el expense_ledger. Solo permitido si no tiene pagos registrados.';
