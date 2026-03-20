-- Migration: Add direct_expenses table
-- Allows recording business expenses (fuel, transport, petty cash, etc.)
-- without requiring a supplier or purchase order.
-- Each inserted expense automatically posts to expense_ledger so it shows
-- up in all financial reports (cash_expense bucket).

-- =============================================================================
-- 1. Extend expense_ledger event_type CHECK to allow 'direct_expense'
-- =============================================================================

ALTER TABLE expense_ledger
  DROP CONSTRAINT IF EXISTS expense_ledger_event_type_check;

ALTER TABLE expense_ledger
  ADD CONSTRAINT expense_ledger_event_type_check
  CHECK (event_type IN (
    'invoice',
    'payment',
    'payment_reversal',
    'manual_adjustment',
    'direct_expense'
  ));

-- =============================================================================
-- 2. direct_expenses table
-- =============================================================================

CREATE TABLE IF NOT EXISTS direct_expenses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID          REFERENCES branches(id) ON DELETE SET NULL,
  occurred_at     DATE          NOT NULL DEFAULT CURRENT_DATE,
  category        VARCHAR(100)  NOT NULL DEFAULT 'varios',
  description     TEXT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method  VARCHAR(50)   NOT NULL DEFAULT 'cash',
  notes           TEXT,
  created_by      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_expenses_org_occurred
  ON direct_expenses(organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_expenses_org_category
  ON direct_expenses(organization_id, category);

-- updated_at auto-maintenance
DROP TRIGGER IF EXISTS update_direct_expenses_updated_at ON direct_expenses;
CREATE TRIGGER update_direct_expenses_updated_at
  BEFORE UPDATE ON direct_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. Trigger: sync direct_expense → expense_ledger
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_sync_direct_expense_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO expense_ledger (
      organization_id,
      branch_id,
      supplier_id,
      entry_kind,
      event_type,
      source_table,
      source_id,
      occurred_at,
      currency_code,
      gross_amount,
      tax_amount,
      discount_amount,
      net_amount,
      status,
      metadata,
      created_by
    ) VALUES (
      NEW.organization_id,
      NEW.branch_id,
      NULL,                                          -- no supplier
      'cash',                                        -- direct expenses are always cash outflows
      'direct_expense',
      'direct_expenses',
      NEW.id,
      NEW.occurred_at::TIMESTAMPTZ,
      'UYU',
      NEW.amount,
      0,
      0,
      NEW.amount,
      'posted',
      jsonb_build_object(
        'category',       NEW.category,
        'description',    NEW.description,
        'payment_method', NEW.payment_method,
        'notes',          NEW.notes
      ),
      NEW.created_by
    );

  ELSIF TG_OP = 'DELETE' THEN
    -- Cancel the ledger entry instead of hard-deleting for audit trail
    UPDATE expense_ledger
    SET status = 'cancelled'
    WHERE source_table = 'direct_expenses'
      AND source_id = OLD.id
      AND status = 'posted';

  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_direct_expense_to_ledger ON direct_expenses;
CREATE TRIGGER sync_direct_expense_to_ledger
  AFTER INSERT OR DELETE ON direct_expenses
  FOR EACH ROW EXECUTE FUNCTION trg_sync_direct_expense_to_ledger();

-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

ALTER TABLE direct_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select_direct_expenses" ON direct_expenses;
CREATE POLICY "org_members_select_direct_expenses"
  ON direct_expenses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_members_insert_direct_expenses" ON direct_expenses;
CREATE POLICY "org_members_insert_direct_expenses"
  ON direct_expenses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_members_delete_direct_expenses" ON direct_expenses;
CREATE POLICY "org_members_delete_direct_expenses"
  ON direct_expenses FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE direct_expenses IS
  'Gastos directos del negocio (nafta, transporte, gastos chicos) sin proveedor asociado. '
  'Cada inserción genera automáticamente una entrada en expense_ledger (entry_kind=cash).';
