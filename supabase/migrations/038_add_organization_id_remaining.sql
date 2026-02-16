-- Migration: 038_add_organization_id_remaining.sql
-- Fase 2: Agregar organization_id a tablas que lo necesitan para queries directas
-- Requiere: 037_update_rls_multi_tenant.sql

-- Nota: Las tablas product_variants, product_images, product_barcodes, product_suppliers,
-- branch_inventory, cash_sessions, order_payments, inventory_movements, inventory_transfers
-- obtienen el organization_id vía JOIN con sus tablas padre (products, branches, orders).
-- No es estrictamente necesario agregar la columna para RLS, pero puede mejorar performance
-- en queries que filtran por org. Por ahora las políticas RLS usan EXISTS con JOIN.
-- Esta migración queda como placeholder para futuras optimizaciones si se requiere.

-- ============================================
-- 1. ACTUALIZAR handle_new_user PARA AGREGAR A ORG DEFAULT
-- ============================================
-- Cuando un nuevo usuario se registra, agregarlo a la organización default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear user_profiles (existente)
  BEGIN
    INSERT INTO public.user_profiles (user_id, role, full_name)
    SELECT
      NEW.id,
      'user',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = NEW.id
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user profile failed for auth user %: %', NEW.id, SQLERRM;
  END;

  -- Agregar a organización default como miembro
  BEGIN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT
      (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1),
      NEW.id,
      'user'
    WHERE EXISTS (SELECT 1 FROM organizations WHERE slug = 'default')
    AND NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = NEW.id
      AND om.organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1)
    );
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user org_member failed for auth user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
