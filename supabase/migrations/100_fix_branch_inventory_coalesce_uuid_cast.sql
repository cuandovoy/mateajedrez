-- Fix: COALESCE(NEW.id, 'new') in BEFORE INSERT trigger fails because NEW.id is
-- of type UUID, so PostgreSQL tries to cast the literal 'new' to UUID and raises
-- 22P02 "invalid input syntax for type uuid: 'new'" when NEW.id is NULL
-- (before sequence defaults are applied).
-- Fix: cast NEW.id to text first so COALESCE operates on text types.

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
      COALESCE(NEW.id::text, 'new');
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
      COALESCE(NEW.id::text, 'new'),
      NEW.product_id,
      NEW.variant_id;
  END IF;

  IF v_source_org_id <> v_branch_org_id THEN
    RAISE EXCEPTION
      'Consistencia inválida: branch_inventory % cruza organizaciones (branch_org_id %, source_org_id %)',
      COALESCE(NEW.id::text, 'new'),
      v_branch_org_id,
      v_source_org_id
      USING ERRCODE = '23514',
            HINT = 'Asegura que product_id/variant_id pertenezca a la misma organización que la sucursal.';
  END IF;

  RETURN NEW;
END;
$$;
