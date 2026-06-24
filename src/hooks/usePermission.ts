// src/hooks/usePermission.ts
// Resolves permissions from the org-scoped role loaded in organizationStore (ADR-2).
// Do NOT read profile.role from authStore for permission gating.

import { useOrganizationStore } from '@/store/organizationStore'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Permission,
} from '@/lib/permissions'

/**
 * Hook for checking user permissions against the org-scoped role.
 *
 * While org role data is loading, all checks return false (default-deny).
 *
 * Usage:
 *   const { can, canAny, canAll, isAdmin, isManager } = usePermission()
 *   if (can('ventas:ver')) { ... }
 */
export function usePermission() {
  const orgRole = useOrganizationStore((state) => state.orgRole)
  const orgRoleLoading = useOrganizationStore((state) => state.orgRoleLoading)

  const permissions = orgRole?.permissions ?? []

  return {
    /**
     * Check if the current user has a specific permission.
     * Returns false while loading or when no org role is resolved.
     */
    can: (permission: Permission): boolean =>
      orgRoleLoading ? false : hasPermission(permissions, permission),

    /**
     * Check if the current user has at least one of the given permissions.
     */
    canAny: (perms: Permission[]): boolean =>
      orgRoleLoading ? false : hasAnyPermission(permissions, perms),

    /**
     * Check if the current user has all of the given permissions.
     */
    canAll: (perms: Permission[]): boolean =>
      orgRoleLoading ? false : hasAllPermissions(permissions, perms),

    /**
     * True iff base_role_key === 'admin' in the current org.
     */
    isAdmin: !orgRoleLoading && orgRole?.baseRoleKey === 'admin',

    /**
     * True iff base_role_key is 'admin' or 'manager' in the current org.
     */
    isManager: !orgRoleLoading && ['admin', 'manager'].includes(orgRole?.baseRoleKey ?? ''),

    /**
     * The resolved base role key for display purposes (not for gating logic).
     */
    baseRoleKey: orgRole?.baseRoleKey ?? null,

    /** True while the org role permissions are being loaded */
    loading: orgRoleLoading,
  }
}
