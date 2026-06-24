import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useOrganizationStore } from '@/store/organizationStore'
import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@/lib/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode

  /**
   * Require base_role_key === 'admin' in the current org.
   * All hook calls happen unconditionally at the top of the component (rules of hooks fix).
   */
  requireAdmin?: boolean

  /**
   * Single permission or array of permissions required
   */
  requiredPermissions?: Permission | Permission[]

  /**
   * 'any' = at least one permission, 'all' = all permissions
   * @default false (any)
   */
  requireAll?: boolean

  /**
   * Fallback component when permission denied (default: redirect to home)
   */
  fallback?: React.ReactNode
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requiredPermissions,
  requireAll = false,
  fallback,
}: ProtectedRouteProps) {
  // All hooks must be called unconditionally (rules of hooks).
  const { user, loading } = useAuthStore()
  const orgRoleLoading = useOrganizationStore((state) => state.orgRoleLoading)
  // isAdmin is always read here, not inside the requireAdmin conditional.
  const { canAny, canAll, isAdmin } = usePermission()

  // Show skeleton while auth or permission data is loading.
  if (loading || orgRoleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-48 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check module permissions (new system)
  if (requiredPermissions) {
    const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
    const hasAccess = requireAll ? canAll(perms) : canAny(perms)

    if (!hasAccess) {
      return fallback || <Navigate to="/" replace />
    }
  }

  // requireAdmin: checks org-scoped base_role_key === 'admin'
  if (requireAdmin) {
    if (!isAdmin) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}
