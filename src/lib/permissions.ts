// src/lib/permissions.ts
// Permission definitions and role-permission mapping

export type Permission =
  // Products
  | 'products:view'
  | 'products:create'
  | 'products:edit'
  | 'products:delete'
  | 'products:manage_stock'
  
  // Categories
  | 'categories:view'
  | 'categories:create'
  | 'categories:edit'
  | 'categories:delete'
  
  // Orders
  | 'orders:view'
  | 'orders:view_own'
  | 'orders:edit'
  | 'orders:delete'
  
  // Users
  | 'users:view'
  | 'users:edit'
  | 'users:manage_roles'
  | 'users:delete'
  
  // Customers
  | 'customers:view'
  | 'customers:create'
  | 'customers:edit'
  | 'customers:delete'
  | 'customers:export'
  
  // Cash Register
  | 'cash_register:access'
  | 'cash_register:view_sessions'
  | 'cash_register:close_session'
  
  // Inventory
  | 'inventory:view'
  | 'inventory:manage'
  
  // Reports
  | 'reports:view'
  | 'reports:export'
  
  // Settings
  | 'settings:manage'
  | 'settings:manage_roles'
  | 'settings:audit_logs';

export type UserRole = 'user' | 'viewer' | 'manager' | 'admin';

// Local permission matrix (source of truth for checks)
// This is synced with DB but kept here for performance
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // All permissions for admin
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'products:manage_stock',
    'categories:view',
    'categories:create',
    'categories:edit',
    'categories:delete',
    'orders:view',
    'orders:view_own',
    'orders:edit',
    'orders:delete',
    'users:view',
    'users:edit',
    'users:manage_roles',
    'users:delete',
    'customers:view',
    'customers:create',
    'customers:edit',
    'customers:delete',
    'customers:export',
    'cash_register:access',
    'cash_register:view_sessions',
    'cash_register:close_session',
    'inventory:view',
    'inventory:manage',
    'reports:view',
    'reports:export',
    'settings:manage',
    'settings:manage_roles',
    'settings:audit_logs',
  ],
  
  manager: [
    'products:view',
    'products:create',
    'products:edit',
    'products:manage_stock',
    'categories:view',
    'categories:create',
    'categories:edit',
    'orders:view',
    'orders:edit',
    'customers:view',
    'customers:create',
    'customers:edit',
    'cash_register:access',
    'cash_register:view_sessions',
    'cash_register:close_session',
    'inventory:view',
    'inventory:manage',
    'reports:view',
  ],
  
  viewer: [
    'products:view',
    'categories:view',
    'orders:view',
    'customers:view',
    'inventory:view',
    'reports:view',
  ],
  
  user: [
    'products:view',
    'categories:view',
    'orders:view_own',
  ],
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  userRole: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!userRole) return false;
  const rolePerms = ROLE_PERMISSIONS[userRole] || [];
  return rolePerms.includes(permission);
}

/**
 * Check if user has at least one of the given permissions
 */
export function hasAnyPermission(
  userRole: UserRole | null | undefined,
  permissions: Permission[]
): boolean {
  if (!userRole) return false;
  return permissions.some((p) => hasPermission(userRole, p));
}

/**
 * Check if user has all of the given permissions
 */
export function hasAllPermissions(
  userRole: UserRole | null | undefined,
  permissions: Permission[]
): boolean {
  if (!userRole) return false;
  return permissions.every((p) => hasPermission(userRole, p));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsByRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get permission category from permission key
 */
export function getPermissionCategory(permission: Permission): string {
  return permission.split(':')[0];
}

/**
 * Get permission action from permission key
 */
export function getPermissionAction(permission: Permission): string {
  return permission.split(':')[1];
}
