// src/hooks/usePermission.ts
// Hook to check permissions in components

import { useAuthStore } from '@/store/authStore'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Permission,
  type UserRole,
} from '@/lib/permissions'

/**
 * Hook for checking user permissions
 * 
 * Usage:
 * const { can, canAny, canAll, role } = usePermission()
 * if (can('products:edit')) { ... }
 */
export function usePermission() {
  const role = useAuthStore((state) => state.profile?.role) as UserRole | null

  return {
    /**
     * Check if user has a specific permission
     */
    can: (permission: Permission) => hasPermission(role, permission),

    /**
     * Check if user has at least one of the given permissions
     */
    canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),

    /**
     * Check if user has all of the given permissions
     */
    canAll: (permissions: Permission[]) => hasAllPermissions(role, permissions),

    /**
     * Current user role
     */
    role,

    /**
     * Check if user is admin
     */
    isAdmin: role === 'admin',
  }
}
