-- Migration: 112_low_stock_notification.sql
-- Trigger en branch_inventory que envia notificación de stock bajo cuando
-- el stock cae al umbral o por debajo, si la org tiene low_stock_notify = true.
--
-- Anti-spam: solo encola una notificación por (organization_id, product/variant)
-- si no existe ya una con status = 'pending' o enviada en las últimas 24 horas.

-- =============================================================================
-- 1) Ampliar CHECK de notification_queue para aceptar 'low_stock'
--    (el CHECK original solo aceptaba 'new_order', 'low_stock', 'order_status_customer')
-- =============================================================================

ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_type_check;

ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_type_check
  CHECK (type IN ('new_order', 'low_stock', 'order_status_customer'));

-- =============================================================================
-- 2) Trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id        UUID;
  v_settings      JSONB;
  v_notify        BOOLEAN;
  v_email         TEXT;
  v_product_name  TEXT;
  v_variant_name  TEXT;
  v_branch_name   TEXT;
  v_dedup_key     TEXT;
BEGIN
  -- Solo nos interesa cuando el stock baja (no cuando sube)
  IF NEW.stock > OLD.stock THEN
    RETURN NEW;
  END IF;

  -- Solo cuando cruza el umbral (antes estaba bien, ahora está mal o igual)
  -- Disparar si: nuevo stock <= threshold Y (viejo stock > threshold O viejo stock es igual pero queremos renotificar igual en 24h)
  IF NEW.stock > NEW.low_stock_threshold THEN
    RETURN NEW;
  END IF;

  -- Obtener org desde la sucursal
  SELECT b.organization_id
  INTO v_org_id
  FROM public.branches b
  WHERE b.id = NEW.branch_id;

  IF v_org_id IS NULL THEN RETURN NEW; END IF;

  -- Leer configuración de la org
  SELECT o.settings INTO v_settings
  FROM public.organizations o
  WHERE o.id = v_org_id;

  IF v_settings IS NULL THEN RETURN NEW; END IF;

  v_notify := (v_settings->>'low_stock_notify')::boolean = true;
  v_email   := v_settings->>'notification_email';

  IF NOT v_notify OR v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Clave de deduplicación: org + producto/variante
  v_dedup_key := v_org_id::text || ':' ||
    COALESCE(NEW.product_id::text, 'v:' || NEW.variant_id::text);

  -- Anti-spam: no encolar si ya hay una notificación pendiente
  -- o una enviada en las últimas 24 horas para el mismo item
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE organization_id = v_org_id
      AND type = 'low_stock'
      AND (
        status = 'pending'
        OR (status = 'sent' AND created_at > NOW() - INTERVAL '24 hours')
      )
      AND (
        (payload->>'product_id' = NEW.product_id::text AND NEW.product_id IS NOT NULL)
        OR
        (payload->>'variant_id' = NEW.variant_id::text AND NEW.variant_id IS NOT NULL)
      )
  ) THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del producto/variante y sucursal
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.name INTO v_product_name
    FROM public.products p WHERE p.id = NEW.product_id;
    v_variant_name := NULL;
  ELSE
    SELECT p.name, pv.name
    INTO v_product_name, v_variant_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = NEW.variant_id;
  END IF;

  SELECT b.name INTO v_branch_name
  FROM public.branches b WHERE b.id = NEW.branch_id;

  INSERT INTO public.notification_queue (organization_id, type, payload, metadata)
  VALUES (
    v_org_id,
    'low_stock',
    jsonb_build_object(
      'product_id',    NEW.product_id,
      'variant_id',    NEW.variant_id,
      'branch_id',     NEW.branch_id,
      'product_name',  v_product_name,
      'variant_name',  v_variant_name,
      'branch_name',   v_branch_name,
      'stock',         NEW.stock,
      'threshold',     NEW.low_stock_threshold,
      'notification_email', v_email
    ),
    jsonb_build_object(
      'dedup_key', v_dedup_key
    )
  );

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3) Crear trigger en branch_inventory
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON public.branch_inventory;

CREATE TRIGGER trigger_notify_low_stock
  AFTER UPDATE OF stock ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();
