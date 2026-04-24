-- Tabla para líneas manuales de ventas (sin producto del catálogo)
CREATE TABLE IF NOT EXISTS public.order_manual_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_manual_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_order_manual_items"
  ON public.order_manual_items FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_insert_order_manual_items"
  ON public.order_manual_items FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_update_order_manual_items"
  ON public.order_manual_items FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_delete_order_manual_items"
  ON public.order_manual_items FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_order_manual_items_order_id
  ON public.order_manual_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_manual_items_org_id
  ON public.order_manual_items(organization_id);
