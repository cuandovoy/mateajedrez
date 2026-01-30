import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@/lib/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  
  /**
   * @deprecated Use requiredPermissions instead
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
  const { user, loading } = useAuthStore()
  const { canAny, canAll } = usePermission()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check permissions (new system)
  if (requiredPermissions) {
    debugger
    const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
    const hasAccess = requireAll ? canAll(perms) : canAny(perms)
    
    if (!hasAccess) {
      return fallback || <Navigate to="/" replace />
    }
  }
  
  // Legacy: requireAdmin check
  if (requireAdmin) {
    const isAdmin = useAuthStore((state) => state.isAdmin)
    if (!isAdmin) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}
