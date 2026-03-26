import { describe, it, expect } from 'vitest'
import {
  canUseFeature,
  getPlanLimits,
  getProductLimit,
  getBranchLimit,
  getMaxProductImages,
  PLAN_STARTER,
  PLAN_PROFESIONAL,
} from './planLimits'

describe('getPlanLimits', () => {
  it('starter tiene límite de productos', () => {
    const limits = getPlanLimits(PLAN_STARTER)
    expect(limits.products).toBe(700)
    expect(limits.branches).toBe(1)
  })

  it('profesional no tiene límite de productos ni sucursales', () => {
    const limits = getPlanLimits(PLAN_PROFESIONAL)
    expect(limits.products).toBeNull()
    expect(limits.branches).toBeNull()
  })

  it('tier desconocido cae a límites de starter', () => {
    const limits = getPlanLimits('enterprise')
    expect(limits.products).toBe(700)
    expect(limits.branches).toBe(1)
  })
})

describe('getProductLimit', () => {
  it('starter retorna 700', () => {
    expect(getProductLimit(PLAN_STARTER)).toBe(700)
  })

  it('profesional retorna null (ilimitado)', () => {
    expect(getProductLimit(PLAN_PROFESIONAL)).toBeNull()
  })
})

describe('getBranchLimit', () => {
  it('starter retorna 1', () => {
    expect(getBranchLimit(PLAN_STARTER)).toBe(1)
  })

  it('profesional retorna null (ilimitado)', () => {
    expect(getBranchLimit(PLAN_PROFESIONAL)).toBeNull()
  })
})

describe('canUseFeature', () => {
  it('starter puede usar caja registradora', () => {
    expect(canUseFeature(PLAN_STARTER, 'cash_register')).toBe(true)
  })

  it('starter NO puede hacer transferencias entre sucursales', () => {
    expect(canUseFeature(PLAN_STARTER, 'transfers')).toBe(false)
  })

  it('starter NO tiene reportes avanzados', () => {
    expect(canUseFeature(PLAN_STARTER, 'advanced_reports')).toBe(false)
  })

  it('starter NO puede configurar notificaciones', () => {
    expect(canUseFeature(PLAN_STARTER, 'notifications_config')).toBe(false)
  })

  it('profesional puede usar todas las features', () => {
    expect(canUseFeature(PLAN_PROFESIONAL, 'transfers')).toBe(true)
    expect(canUseFeature(PLAN_PROFESIONAL, 'advanced_reports')).toBe(true)
    expect(canUseFeature(PLAN_PROFESIONAL, 'cash_register')).toBe(true)
    expect(canUseFeature(PLAN_PROFESIONAL, 'notifications_config')).toBe(true)
    expect(canUseFeature(PLAN_PROFESIONAL, 'custom_store')).toBe(true)
  })

  it('tier desconocido no puede usar features de pago', () => {
    expect(canUseFeature('free', 'transfers')).toBe(false)
    expect(canUseFeature('free', 'advanced_reports')).toBe(false)
  })
})

describe('getMaxProductImages', () => {
  it('starter permite 1 imagen por producto', () => {
    expect(getMaxProductImages(PLAN_STARTER)).toBe(1)
  })

  it('profesional permite 3 imágenes por producto', () => {
    expect(getMaxProductImages(PLAN_PROFESIONAL)).toBe(3)
  })

  it('tier desconocido retorna límite de starter (1)', () => {
    expect(getMaxProductImages('unknown')).toBe(1)
  })
})
