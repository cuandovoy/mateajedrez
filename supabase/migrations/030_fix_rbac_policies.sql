-- Migration: 030_fix_rbac_policies.sql
-- Update RLS policies to allow users with `settings:manage_roles` permission

-- Remove older policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Only admins can manage roles_permissions" ON roles_permissions;
DROP POLICY IF EXISTS "Only admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Only admins can manage permissions" ON permissions;

-- Policy: allow users who have the permission key 'settings:manage_roles' (by role inheritance or individual override)
-- This uses the view `user_all_permissions` created in previous migration.

CREATE POLICY "Admins or managers with settings:manage_roles can insert roles_permissions"
  ON roles_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_all_permissions p
      WHERE p.user_id = auth.uid() AND p.permission_key = 'settings:manage_roles'
    )
  );

CREATE POLICY "Admins or managers with settings:manage_roles can update roles_permissions"
  ON roles_permissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_all_permissions p
      WHERE p.user_id = auth.uid() AND p.permission_key = 'settings:manage_roles'
    )
  );

-- Also allow managing roles and permissions themselves with the same check
CREATE POLICY "Admins or managers with settings:manage_roles can insert roles"
  ON roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_all_permissions p
      WHERE p.user_id = auth.uid() AND p.permission_key = 'settings:manage_roles'
    )
  );

CREATE POLICY "Admins or managers with settings:manage_roles can update roles"
  ON roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_all_permissions p
      WHERE p.user_id = auth.uid() AND p.permission_key = 'settings:manage_roles'
    )
  );

CREATE POLICY "Admins or managers with settings:manage_roles can insert permissions"
  ON permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_all_permissions p
      WHERE p.user_id = auth.uid() AND p.permission_key = 'settings:manage_roles'
    )
  );

-- Keep a permissive audit-log insert policy (system can write)
-- No changes required for rbac_audit_log

-- End migration
