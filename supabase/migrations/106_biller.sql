-- ─── 106_biller.sql ───────────────────────────────────────────────────────────
-- Integración con Biller v2 para emisión de CFEs ante DGI.
-- Tablas: biller_config (configuración por org) + biller_comprobantes (historial).

-- ─── Configuración Biller por organización ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.biller_config (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ambiente         text        NOT NULL DEFAULT 'test' CHECK (ambiente IN ('test', 'production')),
  token            text        NOT NULL,
  sucursal_id      integer     NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.biller_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_biller_config"
  ON public.biller_config FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ─── Comprobantes emitidos ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.biller_comprobantes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id         uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  biller_id        integer,
  tipo_comprobante integer     NOT NULL,
  serie            text,
  numero           integer,
  numero_interno   text,
  estado           text        NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'anulado', 'error')),
  pdf_url          text,
  raw_response     jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.biller_comprobantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_biller_comprobantes"
  ON public.biller_comprobantes FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_biller_comprobantes_org_order
  ON public.biller_comprobantes (organization_id, order_id);

CREATE INDEX IF NOT EXISTS idx_biller_comprobantes_org_created
  ON public.biller_comprobantes (organization_id, created_at DESC);
