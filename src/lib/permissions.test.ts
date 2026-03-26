import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsByRole,
  ROLE_PERMISSIONS,
} from './permissions'
import type { UserRole, Permission } from './permissions'

describe('hasPermission', () => {
  it('admin tiene todos los permisos', () => {
    const allPerms = ROLE_PERMISSIONS.admin
    for (const perm of allPerms) {
      expect(hasPermission('admin', perm)).toBe(true)
    }
  })

  it('viewer no puede crear productos', () => {
    expect(hasPermission('viewer', 'products:create')).toBe(false)
  })

  it('viewer puede ver productos', () => {
    expect(hasPermission('viewer', 'products:view')).toBe(true)
  })

  it('user solo puede ver sus propias órdenes', () => {
    expect(hasPermission('user', 'orders:view_own')).toBe(true)
    expect(hasPermission('user', 'orders:view')).toBe(false)
  })

  it('manager puede gestionar inventario', () => {
    expect(hasPermission('manager', 'inventory:manage')).toBe(true)
  })

  it('manager no puede gestionar configuración', () => {
    expect(hasPermission('manager', 'settings:manage')).toBe(false)
  })

  it('manager no puede eliminar usuarios', () => {
    expect(hasPermission('manager', 'users:delete')).toBe(false)
  })

  it('retorna false para rol nulo', () => {
    expect(hasPermission(null, 'products:view')).toBe(false)
  })

  it('retorna false para rol undefined', () => {
    expect(hasPermission(undefined, 'products:view')).toBe(false)
  })

  it('retorna false para rol desconocido', () => {
    expect(hasPermission('unknown' as UserRole, 'products:view')).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('retorna true si tiene al menos uno', () => {
    expect(hasAnyPermission('viewer', ['products:create', 'products:view'])).toBe(true)
  })

  it('retorna false si no tiene ninguno', () => {
    expect(hasAnyPermission('viewer', ['products:create', 'products:delete'])).toBe(false)
  })

  it('retorna false para lista vacía', () => {
    expect(hasAnyPermission('admin', [])).toBe(false)
  })

  it('retorna false para rol nulo', () => {
    expect(hasAnyPermission(null, ['products:view'])).toBe(false)
  })
})

describe('hasAllPermissions', () => {
  it('retorna true si tiene todos', () => {
    expect(hasAllPermissions('admin', ['products:view', 'products:create', 'products:delete'])).toBe(true)
  })

  it('retorna false si le falta uno', () => {
    expect(hasAllPermissions('viewer', ['products:view', 'products:create'])).toBe(false)
  })

  it('retorna false para rol nulo', () => {
    expect(hasAllPermissions(null, ['products:view'])).toBe(false)
  })
})

describe('getPermissionsByRole', () => {
  it('admin tiene más permisos que manager', () => {
    const adminPerms = getPermissionsByRole('admin')
    const managerPerms = getPermissionsByRole('manager')
    expect(adminPerms.length).toBeGreaterThan(managerPerms.length)
  })

  it('viewer tiene menos permisos que manager', () => {
    const viewerPerms = getPermissionsByRole('viewer')
    const managerPerms = getPermissionsByRole('manager')
    expect(viewerPerms.length).toBeLessThan(managerPerms.length)
  })

  it('retorna array vacío para rol inválido', () => {
    expect(getPermissionsByRole('ghost' as UserRole)).toEqual([])
  })
})

describe('seguridad entre roles', () => {
  const sensitivePerms: Permission[] = [
    'users:delete',
    'users:manage_roles',
    'settings:manage',
    'settings:manage_roles',
    'settings:audit_logs',
  ]

  it('solo admin tiene permisos sensibles', () => {
    const nonAdminRoles: UserRole[] = ['manager', 'viewer', 'user']
    for (const role of nonAdminRoles) {
      for (const perm of sensitivePerms) {
        expect(hasPermission(role, perm)).toBe(false)
      }
    }
  })

  it('user no puede acceder a caja registradora', () => {
    expect(hasPermission('user', 'cash_register:access')).toBe(false)
  })

  it('viewer no puede exportar reportes', () => {
    expect(hasPermission('viewer', 'reports:export')).toBe(false)
  })
})
