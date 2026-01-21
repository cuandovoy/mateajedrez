-- Add cash register system (basic cash opening/closing per branch)
-- This migration creates cash_sessions and order_payments tables
--
-- IMPORTANT: This migration assumes:
-- 1. Migration 016 has been executed (branches table exists)
-- 2. Migration 007 has been executed (payment_method enum exists)
--
-- After this migration:
-- - Admins can open/close cash sessions per branch
-- - Orders can have multiple payments (cash + card, etc.)
-- - Cash payments can be linked to cash sessions
-- - Reports can show daily totals per branch and payment method

-- ============================================
-- 0. ADD 'cash' TO PAYMENT_METHOD ENUM
-- ============================================
-- Add 'cash' payment method to the existing enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cash';

-- ============================================
-- 1. CREATE CASH_SESSIONS TABLE
-- ============================================
-- Tracks cash opening/closing sessions per branch

CREATE TABLE cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  expected_amount DECIMAL(10, 2), -- Calculated: opening + cash payments
  closing_amount DECIMAL(10, 2), -- Actual cash counted at closing
  difference DECIMAL(10, 2), -- Calculated: closing_amount - expected_amount
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: closing_amount should be set when session is closed
  -- We'll enforce this in application logic, not DB constraint (for flexibility)
  CONSTRAINT check_closed_session CHECK (
    (closed_at IS NULL) OR (closing_amount IS NOT NULL)
  )
);

-- Create indexes for cash_sessions
CREATE INDEX idx_cash_sessions_branch_id ON cash_sessions(branch_id);
CREATE INDEX idx_cash_sessions_opened_at ON cash_sessions(opened_at);
CREATE INDEX idx_cash_sessions_closed_at ON cash_sessions(closed_at);
CREATE INDEX idx_cash_sessions_opened_by ON cash_sessions(opened_by);
CREATE INDEX idx_cash_sessions_branch_date ON cash_sessions(branch_id, opened_at);

-- Create unique constraint: only one open session per branch at a time
CREATE UNIQUE INDEX idx_cash_sessions_one_open_per_branch 
  ON cash_sessions(branch_id) 
  WHERE closed_at IS NULL;

-- Create trigger for updated_at on cash_sessions
CREATE TRIGGER update_cash_sessions_updated_at
  BEFORE UPDATE ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. CREATE ORDER_PAYMENTS TABLE
-- ============================================
-- Tracks individual payments for orders (allows multiple payments per order)

CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: cash_session_id should only be set for cash payments
-- This is enforced in application logic, not DB constraint

-- Create indexes for order_payments
CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX idx_order_payments_payment_method ON order_payments(payment_method);
CREATE INDEX idx_order_payments_cash_session_id ON order_payments(cash_session_id);
CREATE INDEX idx_order_payments_created_at ON order_payments(created_at);

-- ============================================
-- 3. HELPER FUNCTION: Calculate expected cash amount
-- ============================================
-- This function calculates the expected cash amount for a session
-- (opening_amount + sum of cash payments linked to this session)

CREATE OR REPLACE FUNCTION calculate_cash_session_expected_amount(session_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  opening DECIMAL(10, 2);
  cash_payments DECIMAL(10, 2);
BEGIN
  -- Get opening amount
  SELECT opening_amount INTO opening
  FROM cash_sessions
  WHERE id = session_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get sum of cash payments linked to this session
  SELECT COALESCE(SUM(amount), 0) INTO cash_payments
  FROM order_payments
  WHERE cash_session_id = session_id
    AND payment_method = 'cash';

  RETURN opening + cash_payments;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. HELPER FUNCTION: Get daily totals per branch
-- ============================================
-- Useful for reports: get totals by payment method per branch for a date

CREATE OR REPLACE FUNCTION get_daily_totals_by_branch(
  branch_id_param UUID,
  date_param DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  payment_method payment_method,
  total_amount DECIMAL(10, 2),
  payment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.payment_method,
    SUM(op.amount) as total_amount,
    COUNT(*) as payment_count
  FROM order_payments op
  INNER JOIN orders o ON op.order_id = o.id
  WHERE o.branch_id = branch_id_param
    AND DATE(op.created_at) = date_param
  GROUP BY op.payment_method
  ORDER BY op.payment_method;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on cash_sessions
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all cash sessions
CREATE POLICY "Cash sessions are viewable by admins"
  ON cash_sessions FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policy: Admins can insert cash sessions
CREATE POLICY "Cash sessions are insertable by admins"
  ON cash_sessions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update cash sessions
CREATE POLICY "Cash sessions are updatable by admins"
  ON cash_sessions FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete cash sessions
CREATE POLICY "Cash sessions are deletable by admins"
  ON cash_sessions FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Enable RLS on order_payments
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payments for their own orders, admins can view all
CREATE POLICY "Order payments are viewable by order owner or admins"
  ON order_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
        AND (
          o.user_id = auth.uid()
          OR o.user_id IS NULL  -- Guest orders
          OR public.is_admin(auth.uid())
        )
    )
  );

-- Policy: Admins can insert order payments
CREATE POLICY "Order payments are insertable by admins"
  ON order_payments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update order payments
CREATE POLICY "Order payments are updatable by admins"
  ON order_payments FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete order payments
CREATE POLICY "Order payments are deletable by admins"
  ON order_payments FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- NOTES
-- ============================================
-- After this migration:
-- 1. Cash sessions can be opened/closed per branch
-- 2. Orders can have multiple payments tracked
-- 3. Cash payments can be linked to cash sessions
-- 4. Helper functions available for reports
-- 5. TODO: Add 'cash' to payment_method enum if not already present
-- 6. TODO: Update frontend to create order_payments when orders are created
-- 7. TODO: Create admin UI for cash session management
-- 8. TODO: Update reports to show totals by branch and payment method
