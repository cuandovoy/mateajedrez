// src/components/features/PermissionGate.tsx
// Component to conditionally render based on permissions

import type { ReactNode } from 'react'
import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@/lib/permissions'

interface PermissionGateProps {
  /**
   * Single permission or array of permissions to check
   */
  permission: Permission | Permission[]

  /**
   * Component to render if user has permission
   */
  children: ReactNode

  /**
   * Component to render if user doesn't have permission (optional)
   */
  fallback?: ReactNode

  /**
   * 'any' = at least one permission, 'all' = all permissions
   * @default 'any'
   */
  require?: 'any' | 'all'
}

/**
 * Conditionally render content based on user permissions
 * 
 * Usage:
 * <PermissionGate permission="products:edit">
 *   <Button>Edit Product</Button>
 * </PermissionGate>
 * 
 * <PermissionGate permission={['products:create', 'products:edit']} require="any">
 *   <Button>Manage Products</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
  require = 'any',
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermission()

  const permissions = Array.isArray(permission) ? permission : [permission]
  const hasAccess = require === 'any' ? canAny(permissions) : canAll(permissions)

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
