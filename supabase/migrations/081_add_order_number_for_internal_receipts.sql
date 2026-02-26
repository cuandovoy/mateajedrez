-- Agrega número corto de orden por organización para uso comercial (boleta interna, listados).
-- Mantiene UUID como identificador técnico.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number BIGINT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_number_positive;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_number_positive
  CHECK (order_number IS NULL OR order_number > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_org_order_number_unique
  ON public.orders(organization_id, order_number)
  WHERE order_number IS NOT NULL;

-- Tabla liviana de contadores por organización (evita lock global en orders).
CREATE TABLE IF NOT EXISTS public.organization_order_counters (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_order_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_organization_order_counter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_order_counters (organization_id, last_order_number)
  VALUES (NEW.organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_order_number = organization_order_counters.last_order_number + 1
  RETURNING last_order_number INTO v_next;

  NEW.order_number := v_next;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_organization_order_counter ON public.organization_order_counters;
CREATE TRIGGER trg_touch_organization_order_counter
BEFORE UPDATE ON public.organization_order_counters
FOR EACH ROW
EXECUTE FUNCTION public.touch_organization_order_counter();

DROP TRIGGER IF EXISTS trg_assign_order_number_on_orders ON public.orders;
CREATE TRIGGER trg_assign_order_number_on_orders
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- Backfill ordenes existentes sin número.
-- Usa el máximo actual por organización para evitar colisiones si ya había order_number cargados.
WITH org_max AS (
  SELECT
    o.organization_id,
    COALESCE(MAX(o.order_number), 0) AS max_number
  FROM public.orders o
  GROUP BY o.organization_id
),
missing AS (
  SELECT
    o.id,
    o.organization_id,
    om.max_number
      + ROW_NUMBER() OVER (
          PARTITION BY o.organization_id
          ORDER BY o.created_at NULLS LAST, o.id
        ) AS new_order_number
  FROM public.orders o
  JOIN org_max om ON om.organization_id = o.organization_id
  WHERE o.order_number IS NULL
)
UPDATE public.orders o
SET order_number = m.new_order_number
FROM missing m
WHERE o.id = m.id;

INSERT INTO public.organization_order_counters (organization_id, last_order_number)
SELECT
  o.organization_id,
  COALESCE(MAX(o.order_number), 0) AS last_order_number
FROM public.orders o
GROUP BY o.organization_id
ON CONFLICT (organization_id)
DO UPDATE
SET last_order_number = GREATEST(
  organization_order_counters.last_order_number,
  EXCLUDED.last_order_number
);

COMMENT ON COLUMN public.orders.order_number
IS 'Número comercial corto de orden, secuencial por organización.';

COMMENT ON TABLE public.organization_order_counters
IS 'Contador secuencial por organización para asignar order_number en orders.';
