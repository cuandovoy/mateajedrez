-- Permite vincular gastos directos a una sesión de caja
ALTER TABLE public.direct_expenses
ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_direct_expenses_cash_session
  ON public.direct_expenses(cash_session_id)
  WHERE cash_session_id IS NOT NULL;
