// src/lib/permissions.ts
// 16 module-level permission keys (8 modules x {ver, gestionar}).
// DB is the runtime authority; these constants are for seeding, labelling, and type safety only.

export const MODULES = [
  'ventas',
  'catalogo',
  'inventario',
  'compras',
  'clientes',
  'caja',
  'reportes',
  'configuracion',
] as const

export type Module = typeof MODULES[number]

export type Action = 'ver' | 'gestionar'

/** 16 valid permission keys: {module}:{action} */
export type Permission = `${Module}:${Action}`

/** Legacy role string — still used in DB columns and legacy contexts */
export type UserRole = 'user' | 'viewer' | 'manager' | 'admin'

/** UI metadata for the Roles page: display label and associated admin routes */
export const MODULE_META: Record<Module, { label: string; routes: string[] }> = {
  ventas:        { label: 'Ventas',         routes: ['/orders', '/billing'] },
  catalogo:      { label: 'Catálogo',       routes: ['/products', '/categories'] },
  inventario:    { label: 'Inventario',     routes: ['/inventory', '/reposicion', '/branches', '/transfers'] },
  compras:       { label: 'Compras',        routes: ['/expenses', '/suppliers'] },
  clientes:      { label: 'Clientes',       routes: ['/customers'] },
  caja:          { label: 'Caja',           routes: ['/cash-register'] },
  reportes:      { label: 'Reportes',       routes: ['/reports'] },
  // org settings; /users and /roles-permissions stay adminOnly, not module-gated
  configuracion: { label: 'Configuración',  routes: [] },
}

/**
 * Seed map of default permissions for system roles.
 * Used to generate the DB migration and to reset roles to defaults in the UI.
 * NOT consulted at permission-check time — usePermission reads the DB-loaded list.
 */
export const SYSTEM_ROLE_DEFAULTS: Record<'admin' | 'manager' | 'viewer' | 'user', Permission[]> = {
  admin: [
    'ventas:ver', 'ventas:gestionar',
    'catalogo:ver', 'catalogo:gestionar',
    'inventario:ver', 'inventario:gestionar',
    'compras:ver', 'compras:gestionar',
    'clientes:ver', 'clientes:gestionar',
    'caja:ver', 'caja:gestionar',
    'reportes:ver', 'reportes:gestionar',
    'configuracion:ver', 'configuracion:gestionar',
  ],
  manager: [
    'ventas:ver', 'ventas:gestionar',
    'catalogo:ver', 'catalogo:gestionar',
    'inventario:ver', 'inventario:gestionar',
    'compras:ver', 'compras:gestionar',
    'clientes:ver', 'clientes:gestionar',
    'caja:ver', 'caja:gestionar',
    'reportes:ver', 'reportes:gestionar',
    // configuracion:ver and configuracion:gestionar are intentionally excluded
  ],
  viewer: [
    'ventas:ver',
    'catalogo:ver',
    'inventario:ver',
    'compras:ver',
    'clientes:ver',
    'caja:ver',
    'reportes:ver',
    'configuracion:ver',
  ],
  user: [
    'ventas:ver',
    'catalogo:ver',
  ],
}

/**
 * Check if a permission list includes a specific permission.
 * Operates on the DB-resolved permission array, NOT a role string.
 */
export function hasPermission(
  permissionsList: Permission[] | null | undefined,
  permission: Permission
): boolean {
  if (!permissionsList || permissionsList.length === 0) return false
  return permissionsList.includes(permission)
}

/**
 * Check if a permission list includes at least one of the given permissions.
 */
export function hasAnyPermission(
  permissionsList: Permission[] | null | undefined,
  permissions: Permission[]
): boolean {
  if (!permissionsList || permissionsList.length === 0) return false
  return permissions.some((p) => permissionsList.includes(p))
}

/**
 * Check if a permission list includes all of the given permissions.
 */
export function hasAllPermissions(
  permissionsList: Permission[] | null | undefined,
  permissions: Permission[]
): boolean {
  if (!permissionsList || permissionsList.length === 0) return false
  return permissions.every((p) => permissionsList.includes(p))
}

/**
 * Get the module (category) from a permission key.
 * e.g. 'ventas:gestionar' → 'ventas'
 */
export function getPermissionCategory(permission: Permission): string {
  return permission.split(':')[0]
}

/**
 * Get the action from a permission key.
 * e.g. 'ventas:gestionar' → 'gestionar'
 */
export function getPermissionAction(permission: Permission): string {
  return permission.split(':')[1]
}
