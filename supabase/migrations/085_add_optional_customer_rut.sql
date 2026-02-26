-- Agrega RUT opcional para clientes (persona/empresa).
-- Permite buscar y vincular clientes por RUT en caja/órdenes.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS rut VARCHAR(32);

UPDATE public.customers
SET rut = NULL
WHERE rut IS NOT NULL
  AND BTRIM(rut) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_rut
  ON public.customers (organization_id, lower(rut))
  WHERE rut IS NOT NULL
    AND BTRIM(rut) <> '';

COMMENT ON COLUMN public.customers.rut
IS 'RUT fiscal opcional del cliente (persona o empresa), único por organización cuando se informa.';
