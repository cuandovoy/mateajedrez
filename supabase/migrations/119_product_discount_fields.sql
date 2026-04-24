ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT NULL CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  ADD COLUMN IF NOT EXISTS discount_expires_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.products.discount_percentage IS 'Porcentaje de descuento activo (0-100). NULL = sin descuento.';
COMMENT ON COLUMN public.products.discount_expires_at IS 'Fecha de expiración del descuento. NULL = sin expiración.';
