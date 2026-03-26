-- ─── Tabla user_notifications ────────────────────────────────────────────────
-- Almacena notificaciones in-app por organización.
-- Separada de notification_queue (pipeline de emails).

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        text        NOT NULL,
  title       text        NOT NULL,
  body        text,
  payload     jsonb       NOT NULL DEFAULT '{}',
  -- Clave de deduplicación: si ya existe una notificación sin leer con la misma
  -- clave para la misma org, el INSERT se ignora (ON CONFLICT DO NOTHING).
  dedup_key   text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index principal: notificaciones no leídas por org, ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_user_notifications_org_unread
  ON public.user_notifications(org_id, created_at DESC)
  WHERE read_at IS NULL;

-- Index de deduplicación: unicidad por (org_id, dedup_key) solo para no leídas
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_dedup
  ON public.user_notifications(org_id, dedup_key)
  WHERE read_at IS NULL;

-- Index para limpieza automática de registros viejos
CREATE INDEX IF NOT EXISTS idx_user_notifications_created
  ON public.user_notifications(created_at);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Los miembros de una org pueden leer sus notificaciones
CREATE POLICY "org_members_select_user_notifications"
  ON public.user_notifications FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Solo el sistema (SECURITY DEFINER functions) puede insertar
-- Los miembros pueden marcar como leídas sus propias notificaciones
CREATE POLICY "org_members_update_user_notifications"
  ON public.user_notifications FOR UPDATE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ─── Config por defecto para orgs existentes ──────────────────────────────────
-- Orgs sin inapp_notifications en settings reciben el config por defecto.

UPDATE public.organizations
SET settings = settings || jsonb_build_object(
  'inapp_notifications', jsonb_build_object(
    'new_order',            true,
    'low_stock',            true,
    'low_stock_threshold',  5,
    'order_status_change',  true
  )
)
WHERE settings->'inapp_notifications' IS NULL;

-- ─── Trigger: Nuevo pedido ────────────────────────────────────────────────────

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

  -- Activado por defecto si no está configurado
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
  RAISE WARNING 'notify_inapp_new_order falló para order %: % %',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_inapp_new_order ON public.orders;
CREATE TRIGGER trg_notify_inapp_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.organization_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_inapp_new_order();

-- ─── Trigger: Stock bajo ──────────────────────────────────────────────────────

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
  -- Solo cuando el stock baja
  IF NEW.stock >= OLD.stock THEN
    RETURN NEW;
  END IF;

  -- Obtener org desde branch
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

  -- Umbral: config org > umbral de branch_inventory > default 5
  v_threshold := COALESCE(
    NULLIF((v_inapp->>'low_stock_threshold')::int, 0),
    NULLIF(NEW.low_stock_threshold, 0),
    5
  );

  -- Solo notifica si el stock acaba de cruzar el umbral hacia abajo
  IF NEW.stock > v_threshold OR OLD.stock <= v_threshold THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del producto o variante
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

DROP TRIGGER IF EXISTS trg_notify_inapp_low_stock ON public.branch_inventory;
CREATE TRIGGER trg_notify_inapp_low_stock
  AFTER UPDATE OF stock ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_inapp_low_stock();

-- ─── Trigger: Cambio de estado de pedido ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_inapp_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settings      jsonb;
  v_inapp         jsonb;
  v_status_label  text;
  v_order_number  text;
BEGIN
  -- Solo cuando el estado cambia efectivamente
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

DROP TRIGGER IF EXISTS trg_notify_inapp_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_inapp_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_inapp_order_status_change();

-- ─── RPC: marcar notificaciones como leídas ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_org_id  uuid,
  p_ids     uuid[] DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario pertenece a la org
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_ids IS NULL THEN
    -- Marcar todas las no leídas de la org
    UPDATE public.user_notifications
    SET read_at = now()
    WHERE org_id = p_org_id AND read_at IS NULL;
  ELSE
    -- Marcar solo las indicadas
    UPDATE public.user_notifications
    SET read_at = now()
    WHERE org_id = p_org_id AND id = ANY(p_ids) AND read_at IS NULL;
  END IF;
END;
$$;

-- ─── Limpieza automática (>30 días) ──────────────────────────────────────────
-- Función que puede invocarse manualmente o via pg_cron si está disponible.

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.user_notifications
  WHERE created_at < now() - interval '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
