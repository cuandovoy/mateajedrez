-- ── 108_cash_sessions_organization_id.sql ────────────────────────────────────
-- Agrega organization_id a cash_sessions para aislamiento multi-tenant correcto.
-- Backfill desde branches, luego aplica RLS org-scoped.

-- 1. Agregar columna (nullable para el backfill)
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Backfill desde branches
UPDATE public.cash_sessions cs
SET organization_id = b.organization_id
FROM public.branches b
WHERE b.id = cs.branch_id
  AND cs.organization_id IS NULL;

-- 3. Hacer NOT NULL ahora que está populado
ALTER TABLE public.cash_sessions
  ALTER COLUMN organization_id SET NOT NULL;

-- 4. Índice para queries por org
CREATE INDEX IF NOT EXISTS idx_cash_sessions_organization_id
  ON public.cash_sessions(organization_id);

-- 5. Reemplazar RLS policies por versiones org-scoped
DROP POLICY IF EXISTS "Cash sessions are viewable by admins"   ON public.cash_sessions;
DROP POLICY IF EXISTS "Cash sessions are insertable by admins" ON public.cash_sessions;
DROP POLICY IF EXISTS "Cash sessions are updatable by admins"  ON public.cash_sessions;
DROP POLICY IF EXISTS "Cash sessions are deletable by admins"  ON public.cash_sessions;

CREATE POLICY "Cash sessions are viewable by org members"
  ON public.cash_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = cash_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Cash sessions are insertable by org members"
  ON public.cash_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = cash_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Cash sessions are updatable by org members"
  ON public.cash_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = cash_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = cash_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Cash sessions are deletable by org members"
  ON public.cash_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = cash_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );
