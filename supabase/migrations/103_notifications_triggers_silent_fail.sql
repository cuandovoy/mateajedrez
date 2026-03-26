-- Las notificaciones in-app son un sistema secundario.
-- Si el trigger falla por cualquier razón (permisos, constraint, etc.),
-- NO debe hacer rollback de la transacción principal (crear orden, actualizar stock, etc.).
-- Usamos EXCEPTION WHEN OTHERS para capturar cualquier error y loguearlo como WARNING.

CREATE OR REPLACE FUNCTION public.notify_inapp_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settings      jsonb;
  v_inapp         jsonb;
  v_order_number  text;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT settings INTO v_settings
  FROM public.organizations WHERE id = NEW.organization_id;

  v_inapp := v_settings->'inapp_notifications';

  IF (v_inapp->>'new_order')::boolean IS FALSE THEN
    RETURN NEW;
  END IF;

  v_order_number := COALESCE(
    CASE WHEN NEW.order_number IS NOT NULL THEN '#' || NEW.order_number::text END,
    '#' || LEFT(NEW.id::text, 8)
  );

  INSERT INTO public.user_notifications (org_id, type, title, body, payload)
  VALUES (
    NEW.organization_id,
    'new_order',
    'Nuevo pedido ' || v_order_number,
    'Total: $' || ROUND(NEW.total, 2)::text,
    jsonb_build_object(
      'order_id',     NEW.id,
      'order_number', NEW.order_number,
      'total',        NEW.total,
      'status',       NEW.status
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- La notificación falla silenciosamente — la orden se guarda igual
  RAISE WARNING 'notify_inapp_new_order falló para order %: % %',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_inapp_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id    uuid;
  v_settings  jsonb;
  v_inapp     jsonb;
  v_threshold int;
  v_name      text;
  v_dedup     text;
BEGIN
  IF NEW.stock >= OLD.stock THEN
    RETURN NEW;
  END IF;

  SELECT b.organization_id INTO v_org_id
  FROM public.branches b WHERE b.id = NEW.branch_id;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT settings INTO v_settings
  FROM public.organizations WHERE id = v_org_id;

  v_inapp := v_settings->'inapp_notifications';

  IF (v_inapp->>'low_stock')::boolean IS FALSE THEN
    RETURN NEW;
  END IF;

  v_threshold := COALESCE(
    NULLIF((v_inapp->>'low_stock_threshold')::int, 0),
    NULLIF(NEW.low_stock_threshold, 0),
    5
  );

  IF NEW.stock > v_threshold OR OLD.stock <= v_threshold THEN
    RETURN NEW;
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT name INTO v_name FROM public.products WHERE id = NEW.product_id;
    v_dedup := 'low_stock:' || NEW.product_id::text;
  ELSIF NEW.variant_id IS NOT NULL THEN
    SELECT CONCAT(p.name, ' — ', pv.name)
    INTO v_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = NEW.variant_id;
    v_dedup := 'low_stock:' || NEW.variant_id::text;
  END IF;

  v_name := COALESCE(v_name, 'Producto desconocido');

  INSERT INTO public.user_notifications (org_id, type, title, body, payload, dedup_key)
  VALUES (
    v_org_id,
    'low_stock',
    'Stock bajo: ' || v_name,
    'Quedan ' || NEW.stock || ' unidades (umbral: ' || v_threshold || ')',
    jsonb_build_object(
      'product_id',  NEW.product_id,
      'variant_id',  NEW.variant_id,
      'branch_id',   NEW.branch_id,
      'stock',       NEW.stock,
      'threshold',   v_threshold
    ),
    v_dedup
  )
  ON CONFLICT (org_id, dedup_key) WHERE read_at IS NULL
  DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_inapp_low_stock falló para branch_inventory (%,%): % %',
    NEW.branch_id, COALESCE(NEW.product_id::text, NEW.variant_id::text), SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_inapp_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settings      jsonb;
  v_inapp         jsonb;
  v_status_label  text;
  v_order_number  text;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT settings INTO v_settings
  FROM public.organizations WHERE id = NEW.organization_id;

  v_inapp := v_settings->'inapp_notifications';

  IF (v_inapp->>'order_status_change')::boolean IS FALSE THEN
    RETURN NEW;
  END IF;

  v_status_label := CASE NEW.status::text
    WHEN 'pending'    THEN 'Pendiente'
    WHEN 'processing' THEN 'En proceso'
    WHEN 'shipped'    THEN 'Enviado'
    WHEN 'delivered'  THEN 'Entregado'
    WHEN 'cancelled'  THEN 'Cancelado'
    ELSE NEW.status::text
  END;

  v_order_number := COALESCE(
    CASE WHEN NEW.order_number IS NOT NULL THEN '#' || NEW.order_number::text END,
    '#' || LEFT(NEW.id::text, 8)
  );

  INSERT INTO public.user_notifications (org_id, type, title, body, payload, dedup_key)
  VALUES (
    NEW.organization_id,
    'order_status_change',
    'Pedido ' || v_order_number || ': ' || v_status_label,
    'Estado: ' || OLD.status::text || ' → ' || NEW.status::text,
    jsonb_build_object(
      'order_id',     NEW.id,
      'order_number', NEW.order_number,
      'old_status',   OLD.status,
      'new_status',   NEW.status
    ),
    'order_status:' || NEW.id::text || ':' || NEW.status::text
  )
  ON CONFLICT (org_id, dedup_key) WHERE read_at IS NULL
  DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_inapp_order_status_change falló para order %: % %',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;
