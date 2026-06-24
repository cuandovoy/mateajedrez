import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  MODULES,
  SYSTEM_ROLE_DEFAULTS,
  type Permission,
} from './permissions'

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('retorna true cuando el permiso está en la lista', () => {
    expect(hasPermission(['ventas:ver', 'catalogo:ver'], 'ventas:ver')).toBe(true)
  })

  it('retorna false cuando el permiso no está en la lista', () => {
    expect(hasPermission(['ventas:ver', 'catalogo:ver'], 'inventario:ver')).toBe(false)
  })

  it('retorna false para lista vacía', () => {
    expect(hasPermission([], 'ventas:ver')).toBe(false)
  })

  it('retorna false para lista null', () => {
    expect(hasPermission(null, 'ventas:ver')).toBe(false)
  })

  it('retorna false para lista undefined', () => {
    expect(hasPermission(undefined, 'ventas:ver')).toBe(false)
  })

  it('es case-sensitive: gestionar no coincide con ver', () => {
    expect(hasPermission(['ventas:ver'], 'ventas:gestionar')).toBe(false)
  })
})

// ─── hasAnyPermission ─────────────────────────────────────────────────────────

describe('hasAnyPermission', () => {
  it('retorna true cuando al menos un permiso coincide', () => {
    expect(hasAnyPermission(['ventas:ver', 'caja:ver'], ['inventario:ver', 'ventas:ver'])).toBe(true)
  })

  it('retorna false cuando ninguno coincide', () => {
    expect(hasAnyPermission(['ventas:ver'], ['inventario:ver', 'caja:gestionar'])).toBe(false)
  })

  it('retorna false para lista de permisos del usuario vacía', () => {
    expect(hasAnyPermission([], ['ventas:ver'])).toBe(false)
  })

  it('retorna false para lista de permisos del usuario null', () => {
    expect(hasAnyPermission(null, ['ventas:ver'])).toBe(false)
  })

  it('retorna false para lista de permisos requeridos vacía', () => {
    // nothing to match against, so false
    expect(hasAnyPermission(['ventas:ver'], [])).toBe(false)
  })
})

// ─── hasAllPermissions ────────────────────────────────────────────────────────

describe('hasAllPermissions', () => {
  it('retorna true cuando todos los permisos requeridos están en la lista', () => {
    const list: Permission[] = ['ventas:ver', 'ventas:gestionar', 'catalogo:ver']
    expect(hasAllPermissions(list, ['ventas:ver', 'ventas:gestionar'])).toBe(true)
  })

  it('retorna false cuando falta uno de los permisos requeridos', () => {
    expect(hasAllPermissions(['ventas:ver'], ['ventas:ver', 'ventas:gestionar'])).toBe(false)
  })

  it('retorna false para lista de permisos del usuario vacía', () => {
    expect(hasAllPermissions([], ['ventas:ver'])).toBe(false)
  })

  it('retorna false para lista null', () => {
    expect(hasAllPermissions(null, ['ventas:ver'])).toBe(false)
  })
})

// ─── SYSTEM_ROLE_DEFAULTS ─────────────────────────────────────────────────────

describe('SYSTEM_ROLE_DEFAULTS', () => {
  it('admin tiene exactamente 16 claves (8 módulos x 2 acciones)', () => {
    expect(SYSTEM_ROLE_DEFAULTS.admin.length).toBe(16)
  })

  it('admin tiene configuracion:gestionar', () => {
    expect(SYSTEM_ROLE_DEFAULTS.admin).toContain('configuracion:gestionar')
  })

  it('manager NO tiene configuracion:gestionar', () => {
    expect(SYSTEM_ROLE_DEFAULTS.manager).not.toContain('configuracion:gestionar')
  })

  it('manager NO tiene configuracion:ver', () => {
    expect(SYSTEM_ROLE_DEFAULTS.manager).not.toContain('configuracion:ver')
  })

  it('manager tiene 14 claves (todos los módulos excepto configuracion)', () => {
    expect(SYSTEM_ROLE_DEFAULTS.manager.length).toBe(14)
  })

  it('viewer tiene exactamente 8 claves (solo :ver de cada módulo)', () => {
    expect(SYSTEM_ROLE_DEFAULTS.viewer.length).toBe(8)
    for (const key of SYSTEM_ROLE_DEFAULTS.viewer) {
      expect(key.endsWith(':ver')).toBe(true)
    }
  })

  it('viewer NO tiene ninguna clave :gestionar', () => {
    const hasGestionar = SYSTEM_ROLE_DEFAULTS.viewer.some((k) => k.endsWith(':gestionar'))
    expect(hasGestionar).toBe(false)
  })

  it('user tiene exactamente 2 claves: ventas:ver y catalogo:ver', () => {
    expect(SYSTEM_ROLE_DEFAULTS.user).toHaveLength(2)
    expect(SYSTEM_ROLE_DEFAULTS.user).toContain('ventas:ver')
    expect(SYSTEM_ROLE_DEFAULTS.user).toContain('catalogo:ver')
  })

  it('viewer tiene :ver para todos los módulos', () => {
    for (const module of MODULES) {
      expect(SYSTEM_ROLE_DEFAULTS.viewer).toContain(`${module}:ver`)
    }
  })
})

// ─── gestionar NOT imply ver at data layer ────────────────────────────────────

describe('gestionar no implica ver en la capa de datos', () => {
  it(
    'gestionar no otorga :ver — la implicación es solo de UI (ver AdminRolesPermissions checkbox logic)',
    () => {
      // If a list only contains gestionar but not ver, hasPermission returns false for ver
      const listWithOnlyGestionar: Permission[] = ['ventas:gestionar']
      expect(hasPermission(listWithOnlyGestionar, 'ventas:ver')).toBe(false)
    }
  )
})

// ─── Permission type cross-product coverage ───────────────────────────────────

describe('Permission type coverage', () => {
  it('el tipo Permission cubre exactamente 16 combinaciones (8 módulos x 2 acciones)', () => {
    // Verify at runtime that MODULES x ['ver','gestionar'] gives 16 pairs
    const actions = ['ver', 'gestionar'] as const
    const allKeys = MODULES.flatMap((m) => actions.map((a) => `${m}:${a}`))
    expect(allKeys.length).toBe(16)
  })

  it('todas las claves de SYSTEM_ROLE_DEFAULTS.admin coinciden con el patrón {module}:(ver|gestionar)', () => {
    const pattern = /^[a-z]+:(ver|gestionar)$/
    for (const key of SYSTEM_ROLE_DEFAULTS.admin) {
      expect(pattern.test(key)).toBe(true)
    }
  })
})
