-- Umbral por defecto de stock bajo configurable por organización.
-- Reemplaza hardcode 10 al crear filas nuevas de branch_inventory.

CREATE OR REPLACE FUNCTION public.get_org_default_low_stock_threshold(
  p_organization_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE(
      NULLIF((o.settings ->> 'default_low_stock_threshold')::INTEGER, NULL),
      10
    ),
    0
  )
  FROM public.organizations o
  WHERE o.id = p_organization_id
$$;

COMMENT ON FUNCTION public.get_org_default_low_stock_threshold(UUID)
IS 'Devuelve el umbral por defecto de stock bajo para una organización, leyendo organizations.settings.default_low_stock_threshold (fallback 10).';


CREATE OR REPLACE FUNCTION public.create_inventory_for_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  branch_record RECORD;
  v_org_default_threshold INTEGER;
BEGIN
  v_org_default_threshold := public.get_org_default_low_stock_threshold(NEW.organization_id);

  FOR branch_record IN
    SELECT id
    FROM public.branches
    WHERE is_active = true
      AND organization_id = NEW.organization_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.branch_inventory
      WHERE branch_id = branch_record.id
        AND product_id = NEW.id
        AND variant_id IS NULL
    ) THEN
      INSERT INTO public.branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold
      )
      VALUES (
        branch_record.id,
        NEW.id,
        NULL,
        NEW.stock,
        COALESCE(NEW.min_stock, 0),
        CASE
          WHEN NEW.low_stock_threshold IS NULL OR NEW.low_stock_threshold = 10 THEN v_org_default_threshold
          ELSE NEW.low_stock_threshold
        END
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.create_inventory_for_variant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  branch_record RECORD;
  v_org_id UUID;
  v_org_default_threshold INTEGER;
BEGIN
  SELECT p.organization_id
  INTO v_org_id
  FROM public.products p
  WHERE p.id = NEW.product_id;

  v_org_default_threshold := public.get_org_default_low_stock_threshold(v_org_id);

  FOR branch_record IN
    SELECT id
    FROM public.branches
    WHERE is_active = true
      AND organization_id = v_org_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.branch_inventory
      WHERE branch_id = branch_record.id
        AND variant_id = NEW.id
        AND product_id IS NULL
    ) THEN
      INSERT INTO public.branch_inventory (
        branch_id,
        product_id,
        variant_id,
        stock,
        min_stock,
        low_stock_threshold
      )
      VALUES (
        branch_record.id,
        NULL,
        NEW.id,
        0,
        COALESCE(NEW.min_stock, 0),
        CASE
          WHEN NEW.low_stock_threshold IS NULL OR NEW.low_stock_threshold = 10 THEN v_org_default_threshold
          ELSE NEW.low_stock_threshold
        END
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.create_inventory_for_new_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_default_threshold INTEGER;
BEGIN
  v_org_default_threshold := public.get_org_default_low_stock_threshold(NEW.organization_id);

  INSERT INTO public.branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT
    NEW.id,
    p.id,
    NULL,
    0,
    COALESCE(p.min_stock, 0),
    CASE
      WHEN p.low_stock_threshold IS NULL OR p.low_stock_threshold = 10 THEN v_org_default_threshold
      ELSE p.low_stock_threshold
    END
  FROM public.products p
  WHERE p.is_active = true
    AND p.organization_id = NEW.organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.branch_inventory
      WHERE branch_id = NEW.id
        AND product_id = p.id
        AND variant_id IS NULL
    );

  INSERT INTO public.branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT
    NEW.id,
    NULL,
    pv.id,
    0,
    COALESCE(pv.min_stock, 0),
    CASE
      WHEN pv.low_stock_threshold IS NULL OR pv.low_stock_threshold = 10 THEN v_org_default_threshold
      ELSE pv.low_stock_threshold
    END
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE pv.is_active = true
    AND p.organization_id = NEW.organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.branch_inventory
      WHERE branch_id = NEW.id
        AND variant_id = pv.id
        AND product_id IS NULL
    );

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.handle_product_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  branch_record RECORD;
  v_org_default_threshold INTEGER;
BEGIN
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
    v_org_default_threshold := public.get_org_default_low_stock_threshold(NEW.organization_id);

    FOR branch_record IN
      SELECT id
      FROM public.branches
      WHERE is_active = true
        AND organization_id = NEW.organization_id
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.branch_inventory
        WHERE branch_id = branch_record.id
          AND product_id = NEW.id
          AND variant_id IS NULL
      ) THEN
        INSERT INTO public.branch_inventory (
          branch_id,
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold
        )
        VALUES (
          branch_record.id,
          NEW.id,
          NULL,
          0,
          COALESCE(NEW.min_stock, 0),
          CASE
            WHEN NEW.low_stock_threshold IS NULL OR NEW.low_stock_threshold = 10 THEN v_org_default_threshold
            ELSE NEW.low_stock_threshold
          END
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.handle_variant_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  branch_record RECORD;
  v_org_id UUID;
  v_org_default_threshold INTEGER;
BEGIN
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
    SELECT p.organization_id
    INTO v_org_id
    FROM public.products p
    WHERE p.id = NEW.product_id;

    v_org_default_threshold := public.get_org_default_low_stock_threshold(v_org_id);

    FOR branch_record IN
      SELECT id
      FROM public.branches
      WHERE is_active = true
        AND organization_id = v_org_id
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.branch_inventory
        WHERE branch_id = branch_record.id
          AND variant_id = NEW.id
          AND product_id IS NULL
      ) THEN
        INSERT INTO public.branch_inventory (
          branch_id,
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold
        )
        VALUES (
          branch_record.id,
          NULL,
          NEW.id,
          0,
          COALESCE(NEW.min_stock, 0),
          CASE
            WHEN NEW.low_stock_threshold IS NULL OR NEW.low_stock_threshold = 10 THEN v_org_default_threshold
            ELSE NEW.low_stock_threshold
          END
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.populate_missing_inventory_entries()
RETURNS TABLE (
  created_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_rows INTEGER := 0;
BEGIN
  INSERT INTO public.branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT
    b.id,
    p.id,
    NULL,
    0,
    COALESCE(p.min_stock, 0),
    CASE
      WHEN p.low_stock_threshold IS NULL OR p.low_stock_threshold = 10
        THEN public.get_org_default_low_stock_threshold(p.organization_id)
      ELSE p.low_stock_threshold
    END
  FROM public.branches b
  CROSS JOIN public.products p
  WHERE b.is_active = true
    AND p.is_active = true
    AND b.organization_id = p.organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.branch_inventory bi
      WHERE bi.branch_id = b.id
        AND bi.product_id = p.id
        AND bi.variant_id IS NULL
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.branch_inventory (
    branch_id,
    product_id,
    variant_id,
    stock,
    min_stock,
    low_stock_threshold
  )
  SELECT
    b.id,
    NULL,
    pv.id,
    0,
    COALESCE(pv.min_stock, 0),
    CASE
      WHEN pv.low_stock_threshold IS NULL OR pv.low_stock_threshold = 10
        THEN public.get_org_default_low_stock_threshold(p.organization_id)
      ELSE pv.low_stock_threshold
    END
  FROM public.branches b
  CROSS JOIN public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE b.is_active = true
    AND pv.is_active = true
    AND b.organization_id = p.organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.branch_inventory bi
      WHERE bi.branch_id = b.id
        AND bi.variant_id = pv.id
        AND bi.product_id IS NULL
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  RETURN QUERY SELECT v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_product_stock_with_inventory(
  p_product_id UUID,
  p_branch_id UUID,
  p_new_stock INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_inventory_id UUID;
  v_previous_stock INTEGER := 0;
  v_total_stock INTEGER := 0;
BEGIN
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id es requerido';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id es requerido';
  END IF;

  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'new_stock inválido';
  END IF;

  SELECT organization_id
  INTO v_org_id
  FROM public.products
  WHERE id = p_product_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece a la organización del producto';
  END IF;

  SELECT bi.id, bi.stock
  INTO v_inventory_id, v_previous_stock
  FROM public.branch_inventory bi
  WHERE bi.branch_id = p_branch_id
    AND bi.product_id = p_product_id
    AND bi.variant_id IS NULL
  LIMIT 1;

  IF v_inventory_id IS NULL THEN
    INSERT INTO public.branch_inventory (
      branch_id,
      product_id,
      variant_id,
      stock,
      min_stock,
      low_stock_threshold
    )
    VALUES (
      p_branch_id,
      p_product_id,
      NULL,
      p_new_stock,
      0,
      public.get_org_default_low_stock_threshold(v_org_id)
    )
    RETURNING id, stock INTO v_inventory_id, v_previous_stock;

    v_previous_stock := 0;
  ELSE
    UPDATE public.branch_inventory
    SET stock = p_new_stock,
        updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  INSERT INTO public.inventory_movements (
    branch_inventory_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reference_type,
    notes,
    created_by
  )
  VALUES (
    v_inventory_id,
    'adjustment',
    p_new_stock - v_previous_stock,
    v_previous_stock,
    p_new_stock,
    'product_stock_set',
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Ajuste de stock desde productos'),
    auth.uid()
  );

  SELECT COALESCE(SUM(bi.stock), 0)::INTEGER
  INTO v_total_stock
  FROM public.branch_inventory bi
  JOIN public.branches b ON b.id = bi.branch_id
  WHERE bi.product_id = p_product_id
    AND bi.variant_id IS NULL
    AND b.organization_id = v_org_id;

  UPDATE public.products
  SET stock = v_total_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'branch_id', p_branch_id,
    'branch_inventory_id', v_inventory_id,
    'previous_stock', v_previous_stock,
    'new_stock', p_new_stock,
    'total_stock', v_total_stock
  );
END;
$$;

COMMENT ON FUNCTION public.update_product_stock_with_inventory(UUID, UUID, INTEGER, TEXT)
IS 'Ajusta stock por sucursal (branch_inventory) y recalcula products.stock agregado para compatibilidad. Usa umbral por defecto de la organización al crear filas nuevas.';
