-- Migration 139: Auto-seed system roles for new organizations
-- Creates a trigger that fires AFTER INSERT ON organizations to seed the 4 system
-- roles and their module permissions. Applies to new orgs created after migration 089.
-- Also backfills any orgs that slipped through (created after 089, missing system roles).
-- User applies manually.

-- ─── Helper function ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_org_system_roles(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_id       UUID;
  v_perm_ids      UUID[];
  v_current_keys  TEXT[];

  v_keys  TEXT[] := ARRAY['admin', 'manager', 'viewer', 'user'];
  v_names TEXT[] := ARRAY['Administrador', 'Gerente', 'Visualizador', 'Usuario'];
  v_descs TEXT[] := ARRAY[
    'Acceso completo a la organización',
    'Gestión operativa sin acceso a configuración',
    'Solo lectura en módulos operativos',
    'Acceso básico a ventas y catálogo'
  ];
  i INT;
BEGIN
  FOR i IN 1..4 LOOP
    -- Create system role (idempotent)
    INSERT INTO public.organization_roles
      (organization_id, key, name, description, is_system, base_role_key, is_active)
    VALUES
      (p_org_id, v_keys[i], v_names[i], v_descs[i], true, v_keys[i], true)
    ON CONFLICT (organization_id, key) DO NOTHING;

    SELECT id INTO v_role_id
    FROM public.organization_roles
    WHERE organization_id = p_org_id AND key = v_keys[i];

    IF v_role_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Pick permission keys for this role (mirrors SYSTEM_ROLE_DEFAULTS in permissions.ts)
    v_current_keys := CASE v_keys[i]
      WHEN 'admin' THEN ARRAY[
        'ventas:ver','ventas:gestionar',
        'catalogo:ver','catalogo:gestionar',
        'inventario:ver','inventario:gestionar',
        'compras:ver','compras:gestionar',
        'clientes:ver','clientes:gestionar',
        'caja:ver','caja:gestionar',
        'reportes:ver','reportes:gestionar',
        'configuracion:ver','configuracion:gestionar'
      ]
      WHEN 'manager' THEN ARRAY[
        'ventas:ver','ventas:gestionar',
        'catalogo:ver','catalogo:gestionar',
        'inventario:ver','inventario:gestionar',
        'compras:ver','compras:gestionar',
        'clientes:ver','clientes:gestionar',
        'caja:ver','caja:gestionar',
        'reportes:ver','reportes:gestionar'
      ]
      WHEN 'viewer' THEN ARRAY[
        'ventas:ver','catalogo:ver','inventario:ver','compras:ver',
        'clientes:ver','caja:ver','reportes:ver','configuracion:ver'
      ]
      ELSE ARRAY['ventas:ver','catalogo:ver']  -- user
    END;

    -- Seed only the permission keys that already exist in the permissions table
    -- (migration 138 may or may not have been applied yet)
    SELECT ARRAY_AGG(id) INTO v_perm_ids
    FROM public.permissions
    WHERE key = ANY(v_current_keys);

    IF v_perm_ids IS NOT NULL THEN
      INSERT INTO public.organization_role_permissions (organization_role_id, permission_id)
      SELECT v_role_id, UNNEST(v_perm_ids)
      ON CONFLICT (organization_role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ─── Trigger ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_seed_org_system_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.seed_org_system_roles(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_org_insert_seed_roles ON public.organizations;
CREATE TRIGGER trg_after_org_insert_seed_roles
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_org_system_roles();

-- ─── Backfill: orgs missing system roles (created between 089 and now) ─────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id
    FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_roles orr
      WHERE orr.organization_id = o.id AND orr.is_system = true
    )
  LOOP
    PERFORM public.seed_org_system_roles(r.id);
  END LOOP;
END;
$$;

-- ─── Link members whose organization_role_id is still NULL ─────────────────────
-- Covers members that were added to orgs before this migration ran.

UPDATE public.organization_members om
SET organization_role_id = orr.id
FROM public.organization_roles orr
WHERE om.organization_role_id IS NULL
  AND orr.organization_id = om.organization_id
  AND orr.key = om.role
  AND orr.is_system = true;
