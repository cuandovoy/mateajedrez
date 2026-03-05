-- Guardrails para consistencia multi-tenant en branch_inventory
-- Problema: branch_inventory puede referenciar productos/variantes de otra organización.
-- Solución:
-- 1) Vista de diagnóstico para filas inválidas existentes.
-- 2) Trigger BEFORE INSERT/UPDATE para impedir nuevos cruces de organización.

-- ============================================
-- 1) Vista de diagnóstico
-- ============================================
CREATE OR REPLACE VIEW public.branch_inventory_org_mismatches AS
SELECT
  bi.id AS branch_inventory_id,
  bi.branch_id,
  b.organization_id AS branch_org_id,
  bi.product_id,
  p.organization_id AS product_org_id,
  bi.variant_id,
  pv.product_id AS variant_product_id,
  pp.organization_id AS variant_org_id,
  bi.stock,
  bi.created_at,
  bi.updated_at
FROM public.branch_inventory bi
JOIN public.branches b
  ON b.id = bi.branch_id
LEFT JOIN public.products p
  ON p.id = bi.product_id
LEFT JOIN public.product_variants pv
  ON pv.id = bi.variant_id
LEFT JOIN public.products pp
  ON pp.id = pv.product_id
WHERE
  (
    bi.product_id IS NOT NULL
    AND p.id IS NOT NULL
    AND p.organization_id <> b.organization_id
  )
  OR
  (
    bi.variant_id IS NOT NULL
    AND pv.id IS NOT NULL
    AND pp.id IS NOT NULL
    AND pp.organization_id <> b.organization_id
  );

COMMENT ON VIEW public.branch_inventory_org_mismatches IS
'Filas de branch_inventory cuyo producto/variante pertenece a una organización distinta a la de la sucursal.';

-- ============================================
-- 2) Trigger guard
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_branch_inventory_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_org_id UUID;
  v_source_org_id UUID;
BEGIN
  SELECT b.organization_id
  INTO v_branch_org_id
  FROM public.branches b
  WHERE b.id = NEW.branch_id;

  IF v_branch_org_id IS NULL THEN
    RAISE EXCEPTION
      'No existe la sucursal % para branch_inventory %',
      NEW.branch_id,
      COALESCE(NEW.id, 'new');
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT p.organization_id
    INTO v_source_org_id
    FROM public.products p
    WHERE p.id = NEW.product_id;
  ELSE
    SELECT p.organization_id
    INTO v_source_org_id
    FROM public.product_variants pv
    JOIN public.products p
      ON p.id = pv.product_id
    WHERE pv.id = NEW.variant_id;
  END IF;

  IF v_source_org_id IS NULL THEN
    RAISE EXCEPTION
      'No se pudo resolver organization_id de origen para branch_inventory % (product_id: %, variant_id: %)',
      COALESCE(NEW.id, 'new'),
      NEW.product_id,
      NEW.variant_id;
  END IF;

  IF v_source_org_id <> v_branch_org_id THEN
    RAISE EXCEPTION
      'Consistencia inválida: branch_inventory % cruza organizaciones (branch_org_id %, source_org_id %)',
      COALESCE(NEW.id, 'new'),
      v_branch_org_id,
      v_source_org_id
      USING ERRCODE = '23514',
            HINT = 'Asegura que product_id/variant_id pertenezca a la misma organización que la sucursal.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_branch_inventory_org_consistency ON public.branch_inventory;
CREATE TRIGGER trg_enforce_branch_inventory_org_consistency
BEFORE INSERT OR UPDATE OF branch_id, product_id, variant_id
ON public.branch_inventory
FOR EACH ROW
EXECUTE FUNCTION public.enforce_branch_inventory_org_consistency();

COMMENT ON FUNCTION public.enforce_branch_inventory_org_consistency() IS
'Impide INSERT/UPDATE en branch_inventory cuando la sucursal y el producto/variante pertenecen a organizaciones distintas.';

-- ============================================
-- 3) Query de ayuda para cleanup manual
-- ============================================
-- SELECT * FROM public.branch_inventory_org_mismatches ORDER BY updated_at DESC;
