-- Soft delete para sucursales
-- Cuando deleted_at IS NOT NULL + is_active = false → marcada para eliminar
-- Una función futura puede purgar las marcadas hace más de 14 días

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
