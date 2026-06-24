-- RPC: get_product_movements
-- Returns a paginated, cross-branch unified timeline of inventory movements for a product.
-- SECURITY INVOKER: RLS on branches and branch_inventory applies; org isolation is double-
-- guarded by the explicit b.organization_id = p_organization_id WHERE clause.
-- User applies this migration manually — never executed by Claude Code.

CREATE OR REPLACE FUNCTION public.get_product_movements(
  p_product_id      UUID,
  p_organization_id UUID,
  p_limit           INT  DEFAULT 25,
  p_offset          INT  DEFAULT 0,
  p_movement_type   TEXT DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  branch_id      UUID,
  branch_name    TEXT,
  movement_type  TEXT,
  quantity       NUMERIC,
  previous_stock NUMERIC,
  new_stock      NUMERIC,
  reference_type TEXT,
  reference_id   UUID,
  notes          TEXT,
  created_at     TIMESTAMPTZ,
  total_count    BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    im.id,
    b.id             AS branch_id,
    b.name           AS branch_name,
    im.movement_type,
    im.quantity,
    im.previous_stock,
    im.new_stock,
    im.reference_type,
    im.reference_id,
    im.notes,
    im.created_at,
    COUNT(*) OVER()  AS total_count
  FROM public.inventory_movements im
  JOIN public.branch_inventory   bi ON bi.id  = im.branch_inventory_id
  JOIN public.branches            b  ON b.id   = bi.branch_id
  WHERE bi.product_id        = p_product_id
    AND b.organization_id    = p_organization_id
    AND (p_movement_type IS NULL OR im.movement_type = p_movement_type)
  ORDER BY im.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- Recommended index to speed up the join traversal and the DESC ordering used
-- by the RPC above. If the index already exists this statement is safe (IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_inventory_movements_bi_created
  ON public.inventory_movements (branch_inventory_id, created_at DESC);
