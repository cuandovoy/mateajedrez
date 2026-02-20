-- Migration: 057_order_status_notify_use_shipping_email.sql
-- Actualiza el trigger de cambio de estado para usar shipping_address.email como fallback
-- cuando no hay customer_id o cuando customers.email está vacío (órdenes invitado, ventas manuales)

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_settings JSONB;
  v_notify BOOLEAN;
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_shipping_address JSONB;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT settings INTO v_settings FROM organizations WHERE id = NEW.organization_id;
  IF v_settings IS NULL THEN RETURN NEW; END IF;

  v_notify := (v_settings->>'order_status_notify_customer')::boolean = true;
  IF NOT v_notify THEN RETURN NEW; END IF;

  -- Buscar email: primero en customers, luego en shipping_address
  v_customer_email := NULL;
  v_customer_name := 'Cliente';

  IF NEW.customer_id IS NOT NULL THEN
    SELECT email, full_name INTO v_customer_email, v_customer_name
    FROM customers WHERE id = NEW.customer_id;
  END IF;

  IF v_customer_email IS NULL OR v_customer_email = '' THEN
    v_shipping_address := NEW.shipping_address;
    IF v_shipping_address IS NOT NULL AND v_shipping_address ? 'email' THEN
      v_customer_email := v_shipping_address->>'email';
      IF v_shipping_address ? 'fullName' THEN
        v_customer_name := COALESCE(v_shipping_address->>'fullName', 'Cliente');
      END IF;
    END IF;
  END IF;

  IF v_customer_email IS NULL OR v_customer_email = '' THEN RETURN NEW; END IF;

  INSERT INTO notification_queue (organization_id, type, payload, metadata)
  VALUES (
    NEW.organization_id,
    'order_status_customer',
    jsonb_build_object(
      'order_id', NEW.id,
      'new_status', NEW.status,
      'customer_email', v_customer_email,
      'customer_name', COALESCE(v_customer_name, 'Cliente'),
      'previous_status', OLD.status
    ),
    jsonb_build_object('order_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
