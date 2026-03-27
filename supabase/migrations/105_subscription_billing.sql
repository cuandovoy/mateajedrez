-- ═══════════════════════════════════════════════════════════════════════════════
-- 105_subscription_billing.sql
-- Sistema de suscripciones mensual con trial de 10 días
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Nuevos campos en organizations ────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at        timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Migrar orgs existentes: si no tienen trial_ends_at, asumir que ya pasaron el trial
-- y darles 30 días de gracia desde hoy para que no se bloqueen de golpe
UPDATE public.organizations
SET
  trial_ends_at           = created_at + interval '10 days',
  subscription_expires_at = now() + interval '30 days',
  subscription_status     = 'active'
WHERE trial_ends_at IS NULL;

-- Default para orgs nuevas: status = 'trialing', trial = 10 días desde ahora
ALTER TABLE public.organizations
  ALTER COLUMN subscription_status SET DEFAULT 'trialing';

-- ─── 2. Trigger: setear trial_ends_at automáticamente al crear org ─────────────

CREATE OR REPLACE FUNCTION public.set_org_trial_on_create()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Solo si no viene explícitamente seteado
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NEW.created_at + interval '10 days';
  END IF;
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trialing';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_org_trial ON public.organizations;
CREATE TRIGGER trg_set_org_trial
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_org_trial_on_create();

-- ─── 3. Tabla de pagos ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_payments (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount            numeric(12,2) NOT NULL,
  plan              text          NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'profesional')),
  period_months     integer       NOT NULL DEFAULT 1 CHECK (period_months BETWEEN 1 AND 12),
  covered_from      date          NOT NULL,
  covered_to        date          NOT NULL,
  notes             text,
  registered_by     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_payments_org_date
  ON public.organization_payments(organization_id, covered_to DESC);

-- RLS
ALTER TABLE public.organization_payments ENABLE ROW LEVEL SECURITY;

-- Solo admins de la plataforma pueden ver/insertar pagos
-- (miembros con role='admin' en esa org)
CREATE POLICY "org_admin_select_payments"
  ON public.organization_payments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org_admin_insert_payments"
  ON public.organization_payments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org_admin_delete_payments"
  ON public.organization_payments FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 4. RPC: registrar pago y reactivar suscripción ──────────────────────────

CREATE OR REPLACE FUNCTION public.register_org_payment(
  p_organization_id uuid,
  p_amount          numeric,
  p_plan            text,
  p_period_months   integer,
  p_covered_from    date,
  p_notes           text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_covered_to    date;
  v_payment_id    uuid;
  v_expires_at    timestamptz;
BEGIN
  -- Calcular fecha fin del período cubierto
  v_covered_to := p_covered_from + (p_period_months || ' months')::interval - interval '1 day';

  -- Insertar pago
  INSERT INTO public.organization_payments (
    organization_id, amount, plan, period_months,
    covered_from, covered_to, notes, registered_by
  ) VALUES (
    p_organization_id, p_amount, p_plan, p_period_months,
    p_covered_from, v_covered_to, p_notes, auth.uid()
  ) RETURNING id INTO v_payment_id;

  -- subscription_expires_at = fin del período + 10 días de gracia
  v_expires_at := (v_covered_to + interval '10 days')::timestamptz;

  -- Actualizar la org
  UPDATE public.organizations
  SET
    subscription_status     = 'active',
    subscription_tier       = p_plan,
    subscription_expires_at = GREATEST(subscription_expires_at, v_expires_at)
  WHERE id = p_organization_id;

  RETURN v_payment_id;
END;
$$;
