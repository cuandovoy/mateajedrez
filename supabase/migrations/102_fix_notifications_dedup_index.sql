-- Corrección: el índice parcial debe coincidir exactamente con la cláusula
-- ON CONFLICT de los triggers. PostgreSQL requiere que la condición WHERE sea
-- idéntica. El índice anterior tenía "AND dedup_key IS NOT NULL" de más.
-- Los NULL en dedup_key ya no participan en la unicidad por naturaleza del índice.

DROP INDEX IF EXISTS public.idx_user_notifications_dedup;

CREATE UNIQUE INDEX idx_user_notifications_dedup
  ON public.user_notifications(org_id, dedup_key)
  WHERE read_at IS NULL;
