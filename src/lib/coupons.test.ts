import { describe, expect, it } from 'vitest'
import {
  buildCouponDiscountMetadata,
  calculateCouponDiscountAmount,
  normalizeCouponCode,
} from './coupons'

describe('normalizeCouponCode', () => {
  it('quita espacios y convierte a mayúsculas', () => {
    expect(normalizeCouponCode('  promo 10  ')).toBe('PROMO10')
  })

  it('preserva símbolos no espaciales', () => {
    expect(normalizeCouponCode('ab-cd')).toBe('AB-CD')
  })
})

describe('calculateCouponDiscountAmount', () => {
  it('descuenta un monto fijo', () => {
    expect(calculateCouponDiscountAmount('fixed_amount', 500, 1200)).toBe(500)
  })

  it('no descuenta más que el subtotal', () => {
    expect(calculateCouponDiscountAmount('fixed_amount', 1500, 1200)).toBe(1200)
  })

  it('descuenta un porcentaje', () => {
    expect(calculateCouponDiscountAmount('percentage', 10, 2500)).toBe(250)
  })

  it('capa el porcentaje a 100', () => {
    expect(calculateCouponDiscountAmount('percentage', 250, 2500)).toBe(2500)
  })

  it('devuelve cero si el subtotal es cero', () => {
    expect(calculateCouponDiscountAmount('percentage', 25, 0)).toBe(0)
  })
})

describe('buildCouponDiscountMetadata', () => {
  it('incluye los datos esperados del cupón', () => {
    const metadata = buildCouponDiscountMetadata(
      {
        id: 'coupon-1',
        code: 'PROMO10',
        kind: 'percentage',
        amount: 10,
        valid_until: '2026-12-31T00:00:00.000Z',
      },
      250,
      '2026-07-29T12:00:00.000Z',
    ) as Record<string, unknown>

    expect(metadata.source).toBe('coupon')
    expect(metadata.coupon_id).toBe('coupon-1')
    expect(metadata.code).toBe('PROMO10')
    expect(metadata.kind).toBe('percentage')
    expect(metadata.value).toBe(10)
    expect(metadata.applied_amount).toBe(250)
    expect(metadata.valid_until).toBe('2026-12-31T00:00:00.000Z')
    expect(metadata.applied_at).toBe('2026-07-29T12:00:00.000Z')
  })
})
