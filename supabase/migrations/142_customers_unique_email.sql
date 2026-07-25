-- Migration: 142_customers_unique_email.sql
-- Cambia la clave de deduplicación de clientes de teléfono a email: el
-- checkout ahora matchea/crea clientes por (organization_id, email) en vez
-- de (organization_id, phone). El email pasa a ser obligatorio en el
-- formulario de checkout y es una clave más confiable — el teléfono puede
-- repetirse entre miembros de una misma familia u operadores que comparten
-- un mismo número, lo que generaba colisiones falsas con el índice anterior.

DROP INDEX IF EXISTS idx_customers_org_phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_email
  ON public.customers (organization_id, email)
  WHERE email IS NOT NULL;
