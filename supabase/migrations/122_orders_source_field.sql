-- Migration: 122_orders_source_field.sql
-- Agrega campo source a orders para distinguir órdenes de tienda vs manuales.
-- Las notificaciones de nueva orden solo se envían para órdenes de la tienda pública.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'store'
    CHECK (source IN ('store', 'manual'));

-- Recrea notify_new_order para saltar órdenes manuales
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_settings JSONB;
  v_notify BOOLEAN;
  v_email TEXT;
BEGIN
  -- No notificar órdenes creadas manualmente desde el admin
  IF NEW.source = 'manual' THEN RETURN NEW; END IF;

  SELECT settings INTO v_settings FROM organizations WHERE id = NEW.organization_id;
  IF v_settings IS NULL THEN RETURN NEW; END IF;

  v_notify := (v_settings->>'new_order_notify')::boolean = true;
  v_email := v_settings->>'notification_email';
  IF NOT v_notify OR v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  INSERT INTO notification_queue (organization_id, type, payload, metadata)
  VALUES (
    NEW.organization_id,
    'new_order',
    jsonb_build_object(
      'order_id', NEW.id,
      'total', NEW.total,
      'status', NEW.status,
      'created_at', NEW.created_at
    ),
    jsonb_build_object('order_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrea notify_inapp_new_order para saltar órdenes manuales
CREATE OR REPLACE FUNCTION public.notify_inapp_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settings      jsonb;
  v_inapp         jsonb;
  v_order_number  text;
BEGIN
  -- No notificar órdenes creadas manualmente desde el admin
  IF NEW.source = 'manual' THEN RETURN NEW; END IF;

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
  RAISE WARNING 'notify_inapp_new_order falló para order %: % %',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;
