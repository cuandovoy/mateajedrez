-- Add mp_payment_id to order_payments for Mercado Pago traceability
-- Also add mp_status to track the raw MP payment status (approved, pending, rejected, etc.)

ALTER TABLE order_payments
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_status     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_mp_payment_id
  ON order_payments (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

COMMENT ON COLUMN order_payments.mp_payment_id IS 'Mercado Pago payment ID (numeric string). Set by mp-webhook.';
COMMENT ON COLUMN order_payments.mp_status     IS 'Raw MP payment status: approved, pending, rejected, etc.';
