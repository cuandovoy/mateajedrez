-- ─── 107_biller_config_tax_settings.sql ──────────────────────────────────────
-- Agrega configuración de IVA por organización a biller_config.

ALTER TABLE public.biller_config
  ADD COLUMN IF NOT EXISTS montos_brutos integer NOT NULL DEFAULT 1
    CHECK (montos_brutos IN (0, 1)),
  ADD COLUMN IF NOT EXISTS indicador_facturacion_default integer NOT NULL DEFAULT 3
    CHECK (indicador_facturacion_default IN (1, 2, 3, 5));

COMMENT ON COLUMN public.biller_config.montos_brutos IS
  '1 = precios con IVA incluido (retail/consumidor final), 0 = precios netos sin IVA (B2B)';
COMMENT ON COLUMN public.biller_config.indicador_facturacion_default IS
  '1=exento, 2=tasa mínima 10%, 3=tasa básica 22%, 5=gratuito';
