-- Migration: 054_notification_queue.sql
-- Cola de notificaciones por email (nueva orden, stock bajo, cambio de estado al cliente)

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_order', 'low_stock', 'order_status_customer')),
  payload JSONB NOT NULL,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_queue_organization_id ON notification_queue(organization_id);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_created_at ON notification_queue(created_at);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Solo admins de la org pueden ver y editar notificaciones de su org
CREATE POLICY "notification_queue_select_org_admin"
  ON notification_queue FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "notification_queue_insert_org_admin"
  ON notification_queue FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "notification_queue_update_org_admin"
  ON notification_queue FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================
-- Triggers: enqueue notifications (SECURITY DEFINER bypasses RLS)
-- ============================================

-- Trigger: nueva orden -> insertar en cola si org tiene new_order_notify
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_settings JSONB;
  v_notify BOOLEAN;
  v_email TEXT;
BEGIN
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

CREATE TRIGGER trigger_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_order();

-- Trigger: cambio de estado de orden -> notificar al cliente si tiene email
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_settings JSONB;
  v_notify BOOLEAN;
  v_customer_email TEXT;
  v_customer_name TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;

  SELECT settings INTO v_settings FROM organizations WHERE id = NEW.organization_id;
  IF v_settings IS NULL THEN RETURN NEW; END IF;

  v_notify := (v_settings->>'order_status_notify_customer')::boolean = true;
  IF NOT v_notify THEN RETURN NEW; END IF;

  SELECT email, full_name INTO v_customer_email, v_customer_name
  FROM customers WHERE id = NEW.customer_id;
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

CREATE TRIGGER trigger_notify_order_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();
