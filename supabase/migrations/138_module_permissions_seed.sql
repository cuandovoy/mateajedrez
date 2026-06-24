-- Migration 138: Seed 16 module permission keys and map system roles
-- User applies manually. Do NOT run via CLI or MCP.
-- This migration is ADDITIVE: legacy 28-key rows are NOT deleted.

DO $$
DECLARE
  v_admin_perm_ids    UUID[];
  v_manager_perm_ids  UUID[];
  v_viewer_perm_ids   UUID[];
  v_user_perm_ids     UUID[];
  v_module_keys       TEXT[] := ARRAY[
    'ventas:ver','ventas:gestionar',
    'catalogo:ver','catalogo:gestionar',
    'inventario:ver','inventario:gestionar',
    'compras:ver','compras:gestionar',
    'clientes:ver','clientes:gestionar',
    'caja:ver','caja:gestionar',
    'reportes:ver','reportes:gestionar',
    'configuracion:ver','configuracion:gestionar'
  ];
  v_perm_names        TEXT[] := ARRAY[
    'Ver ventas','Gestionar ventas',
    'Ver catálogo','Gestionar catálogo',
    'Ver inventario','Gestionar inventario',
    'Ver compras','Gestionar compras',
    'Ver clientes','Gestionar clientes',
    'Ver caja','Gestionar caja',
    'Ver reportes','Gestionar reportes',
    'Ver configuración','Gestionar configuración'
  ];
  v_perm_categories   TEXT[] := ARRAY[
    'ventas','ventas',
    'catalogo','catalogo',
    'inventario','inventario',
    'compras','compras',
    'clientes','clientes',
    'caja','caja',
    'reportes','reportes',
    'configuracion','configuracion'
  ];
  i                   INT;
BEGIN
  -- Step 1: Seed the 16 module permission keys (idempotent)
  FOR i IN 1..array_length(v_module_keys, 1) LOOP
    INSERT INTO public.permissions (key, name, description, category)
    VALUES (
      v_module_keys[i],
      v_perm_names[i],
      'Permiso de módulo: ' || v_module_keys[i],
      v_perm_categories[i]
    )
    ON CONFLICT (key) DO NOTHING;
  END LOOP;

  -- Step 2: Build permission ID arrays per system role
  -- admin: all 16 keys
  SELECT ARRAY_AGG(id) INTO v_admin_perm_ids
  FROM public.permissions
  WHERE key = ANY(v_module_keys);

  -- manager: all except configuracion:ver and configuracion:gestionar
  SELECT ARRAY_AGG(id) INTO v_manager_perm_ids
  FROM public.permissions
  WHERE key = ANY(ARRAY[
    'ventas:ver','ventas:gestionar',
    'catalogo:ver','catalogo:gestionar',
    'inventario:ver','inventario:gestionar',
    'compras:ver','compras:gestionar',
    'clientes:ver','clientes:gestionar',
    'caja:ver','caja:gestionar',
    'reportes:ver','reportes:gestionar'
  ]);

  -- viewer: all 8 :ver keys
  SELECT ARRAY_AGG(id) INTO v_viewer_perm_ids
  FROM public.permissions
  WHERE key = ANY(ARRAY[
    'ventas:ver','catalogo:ver','inventario:ver','compras:ver',
    'clientes:ver','caja:ver','reportes:ver','configuracion:ver'
  ]);

  -- user: ventas:ver, catalogo:ver
  SELECT ARRAY_AGG(id) INTO v_user_perm_ids
  FROM public.permissions
  WHERE key = ANY(ARRAY['ventas:ver','catalogo:ver']);

  -- Step 3: For each org's system roles, replace module-key mappings
  -- We only touch the 16 module-key permissions; legacy 28-key mappings are left intact.
  -- Pattern: delete existing module-key entries for the role, then re-insert.

  -- Admin roles
  DELETE FROM public.organization_role_permissions
  WHERE organization_role_id IN (
    SELECT id FROM public.organization_roles WHERE base_role_key = 'admin' AND is_system = true
  )
  AND permission_id = ANY(
    SELECT id FROM public.permissions WHERE key = ANY(v_module_keys)
  );

  INSERT INTO public.organization_role_permissions (organization_role_id, permission_id)
  SELECT r.id, p
  FROM public.organization_roles r, UNNEST(v_admin_perm_ids) AS p
  WHERE r.base_role_key = 'admin' AND r.is_system = true
  ON CONFLICT (organization_role_id, permission_id) DO NOTHING;

  -- Manager roles
  DELETE FROM public.organization_role_permissions
  WHERE organization_role_id IN (
    SELECT id FROM public.organization_roles WHERE base_role_key = 'manager' AND is_system = true
  )
  AND permission_id = ANY(
    SELECT id FROM public.permissions WHERE key = ANY(v_module_keys)
  );

  INSERT INTO public.organization_role_permissions (organization_role_id, permission_id)
  SELECT r.id, p
  FROM public.organization_roles r, UNNEST(v_manager_perm_ids) AS p
  WHERE r.base_role_key = 'manager' AND r.is_system = true
  ON CONFLICT (organization_role_id, permission_id) DO NOTHING;

  -- Viewer roles
  DELETE FROM public.organization_role_permissions
  WHERE organization_role_id IN (
    SELECT id FROM public.organization_roles WHERE base_role_key = 'viewer' AND is_system = true
  )
  AND permission_id = ANY(
    SELECT id FROM public.permissions WHERE key = ANY(v_module_keys)
  );

  INSERT INTO public.organization_role_permissions (organization_role_id, permission_id)
  SELECT r.id, p
  FROM public.organization_roles r, UNNEST(v_viewer_perm_ids) AS p
  WHERE r.base_role_key = 'viewer' AND r.is_system = true
  ON CONFLICT (organization_role_id, permission_id) DO NOTHING;

  -- User roles
  DELETE FROM public.organization_role_permissions
  WHERE organization_role_id IN (
    SELECT id FROM public.organization_roles WHERE base_role_key = 'user' AND is_system = true
  )
  AND permission_id = ANY(
    SELECT id FROM public.permissions WHERE key = ANY(v_module_keys)
  );

  INSERT INTO public.organization_role_permissions (organization_role_id, permission_id)
  SELECT r.id, p
  FROM public.organization_roles r, UNNEST(v_user_perm_ids) AS p
  WHERE r.base_role_key = 'user' AND r.is_system = true
  ON CONFLICT (organization_role_id, permission_id) DO NOTHING;

END;
$$;
