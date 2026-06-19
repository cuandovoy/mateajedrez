-- Migration: 134_order_payments_updated_at.sql
--
-- Agrega updated_at a order_payments con trigger de auto-update.
-- Sin este campo no hay registro de cuándo cambió un pago (ej: cuando el
-- webhook lo movió de pending a approved), lo que impide auditar disputas.

-- ============================================================
-- 1. Función genérica de auto-update (reutilizable en otras tablas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Columna updated_at en order_payments
-- ============================================================
ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Inicializar updated_at con created_at para filas existentes
UPDATE public.order_payments
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- ============================================================
-- 3. Trigger de auto-update
-- ============================================================
DROP TRIGGER IF EXISTS set_order_payments_updated_at ON public.order_payments;

CREATE TRIGGER set_order_payments_updated_at
  BEFORE UPDATE ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
