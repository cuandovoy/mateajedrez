-- Soft delete para organizaciones
-- Cuando deleted_at IS NOT NULL → marcada para eliminación
-- Los usuarios no pueden acceder a organizaciones marcadas
-- Solo admins pueden marcar/restaurar

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
