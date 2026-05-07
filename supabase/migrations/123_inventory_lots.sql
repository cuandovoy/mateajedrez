-- Migration: 123_inventory_lots.sql
-- Tabla de lotes de inventario para trazabilidad de mercadería recibida.
-- Feature opcional: se activa cuando la org empieza a usarlo.
-- No modifica el flujo existente de ventas ni de inventario.

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id          UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,

  -- Fechas
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,

  -- Stock del lote
  quantity_received   INT NOT NULL CHECK (quantity_received > 0),
  quantity_remaining  INT NOT NULL CHECK (quantity_remaining >= 0),
  quantity_damaged    INT NOT NULL DEFAULT 0 CHECK (quantity_damaged >= 0),

  -- Costo y proveedor (opcionales)
  unit_cost           DECIMAL(12, 4),
  supplier_id         UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reference_document  TEXT,

  -- Estado
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'exhausted', 'written_off')),
  writeoff_reason     TEXT,
  writeoff_at         TIMESTAMPTZ,

  -- Metadata
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_inventory_lots_org       ON public.inventory_lots(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_branch    ON public.inventory_lots(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_product   ON public.inventory_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expires   ON public.inventory_lots(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_lots_status    ON public.inventory_lots(status);

-- Columna lot_id en inventory_movements para trazabilidad
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.inventory_lots(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lots_select_org_members"
  ON public.inventory_lots FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lots_insert_org_members"
  ON public.inventory_lots FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lots_update_org_members"
  ON public.inventory_lots FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lots_delete_org_admin"
  ON public.inventory_lots FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_inventory_lots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_lots_updated_at
  BEFORE UPDATE ON public.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_lots_updated_at();
