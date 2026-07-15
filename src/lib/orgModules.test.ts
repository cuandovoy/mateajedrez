import { describe, it, expect } from 'vitest'
import { resolveBranchesEnabled, resolveTransfersEnabledRaw, resolveTransfersEnabled } from './orgModules'

describe('resolveBranchesEnabled', () => {
  it('retorna true cuando settings es null', () => {
    expect(resolveBranchesEnabled(null)).toBe(true)
  })

  it('retorna true cuando settings es undefined', () => {
    expect(resolveBranchesEnabled(undefined)).toBe(true)
  })

  it('retorna true cuando settings es un objeto vacío', () => {
    expect(resolveBranchesEnabled({})).toBe(true)
  })

  it('retorna true cuando branches_enabled es true', () => {
    expect(resolveBranchesEnabled({ branches_enabled: true })).toBe(true)
  })

  it('retorna false cuando branches_enabled es false', () => {
    expect(resolveBranchesEnabled({ branches_enabled: false })).toBe(false)
  })

  it('retorna true cuando branches_enabled es undefined dentro del objeto', () => {
    expect(resolveBranchesEnabled({ branches_enabled: undefined })).toBe(true)
  })

  it('retorna true para valores no booleanos (solo el literal false deshabilita)', () => {
    expect(resolveBranchesEnabled({ branches_enabled: 'no' as unknown as boolean })).toBe(true)
    expect(resolveBranchesEnabled({ branches_enabled: 0 as unknown as boolean })).toBe(true)
  })
})

describe('resolveTransfersEnabledRaw', () => {
  it('retorna true cuando settings es null', () => {
    expect(resolveTransfersEnabledRaw(null)).toBe(true)
  })

  it('retorna true cuando settings es undefined', () => {
    expect(resolveTransfersEnabledRaw(undefined)).toBe(true)
  })

  it('retorna true cuando settings es un objeto vacío', () => {
    expect(resolveTransfersEnabledRaw({})).toBe(true)
  })

  it('retorna true cuando transfers_enabled es true', () => {
    expect(resolveTransfersEnabledRaw({ transfers_enabled: true })).toBe(true)
  })

  it('retorna false cuando transfers_enabled es false', () => {
    expect(resolveTransfersEnabledRaw({ transfers_enabled: false })).toBe(false)
  })

  it('retorna true cuando transfers_enabled es undefined dentro del objeto', () => {
    expect(resolveTransfersEnabledRaw({ transfers_enabled: undefined })).toBe(true)
  })

  it('retorna true para valores no booleanos (solo el literal false deshabilita)', () => {
    expect(resolveTransfersEnabledRaw({ transfers_enabled: 'no' as unknown as boolean })).toBe(true)
    expect(resolveTransfersEnabledRaw({ transfers_enabled: 0 as unknown as boolean })).toBe(true)
  })
})

describe('resolveTransfersEnabled (cascada branches -> transfers)', () => {
  it('branches on + transfers on -> true', () => {
    expect(resolveTransfersEnabled({ branches_enabled: true, transfers_enabled: true })).toBe(true)
  })

  it('branches on + transfers off -> false (toggle propio)', () => {
    expect(resolveTransfersEnabled({ branches_enabled: true, transfers_enabled: false })).toBe(false)
  })

  it('branches off + transfers on -> false (cascada gana)', () => {
    expect(resolveTransfersEnabled({ branches_enabled: false, transfers_enabled: true })).toBe(false)
  })

  it('branches off + transfers off -> false', () => {
    expect(resolveTransfersEnabled({ branches_enabled: false, transfers_enabled: false })).toBe(false)
  })

  it('settings null -> true (ambos por defecto habilitados)', () => {
    expect(resolveTransfersEnabled(null)).toBe(true)
  })

  it('branches off con transfers ausente -> false (cascada le gana al default-true de transfers)', () => {
    expect(resolveTransfersEnabled({ branches_enabled: false })).toBe(false)
  })
})
