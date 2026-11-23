import { describe, it, expect } from 'vitest'
import {
  MERCADOPAGO_SURCHARGE_PERCENT,
  getSurchargePercent,
  applySurcharge,
  calculateSurchargedPricing,
  removeSurcharge,
} from './paymentSurcharge'

describe('MERCADOPAGO_SURCHARGE_PERCENT', () => {
  it('es 10', () => {
    expect(MERCADOPAGO_SURCHARGE_PERCENT).toBe(10)
  })
})

describe('getSurchargePercent', () => {
  it('retorna 10 para mercadopago', () => {
    expect(getSurchargePercent('mercadopago')).toBe(10)
  })
  it('retorna 0 para transferencia', () => {
    expect(getSurchargePercent('transfer')).toBe(0)
  })
  it('retorna 0 para string vacío, null y undefined', () => {
    expect(getSurchargePercent('')).toBe(0)
    expect(getSurchargePercent(null)).toBe(0)
    expect(getSurchargePercent(undefined)).toBe(0)
  })
})

describe('applySurcharge', () => {
  it('aplica 10% a un monto redondo', () => {
    expect(applySurcharge(100, 10)).toBe(110)
  })
  it('redondea a centavos', () => {
    expect(applySurcharge(10.15, 10)).toBe(11.17) // 11.165 -> 11.17
    expect(applySurcharge(17.15, 10)).toBe(18.87) // 18.865 en float queda 18.8649…; debe redondear hacia arriba
    expect(applySurcharge(0.05, 10)).toBe(0.06) // 0.055 -> 0.06
  })
  it('retorna el mismo monto con 0%', () => {
    expect(applySurcharge(1234.56, 0)).toBe(1234.56)
  })
  it('retorna 0 para monto 0', () => {
    expect(applySurcharge(0, 10)).toBe(0)
  })
  it('retorna 0 para monto negativo, null o NaN', () => {
    expect(applySurcharge(-5, 10)).toBe(0)
    expect(applySurcharge(null, 10)).toBe(0)
    expect(applySurcharge(Number.NaN, 10)).toBe(0)
  })
  it('trata un porcentaje negativo como 0%', () => {
    expect(applySurcharge(100, -10)).toBe(100)
  })
})

describe('removeSurcharge', () => {
  it('quita el recargo de un precio unitario recargado', () => {
    expect(removeSurcharge(110, 10)).toBe(100)
    expect(removeSurcharge(11.17, 10)).toBe(10.15)
  })
  it('retorna el mismo monto con 0%', () => {
    expect(removeSurcharge(110, 0)).toBe(110)
  })
  it('retorna 0 para monto 0, negativo o NaN', () => {
    expect(removeSurcharge(0, 10)).toBe(0)
    expect(removeSurcharge(-1, 10)).toBe(0)
    expect(removeSurcharge(Number.NaN, 10)).toBe(0)
  })
})

describe('calculateSurchargedPricing', () => {
  it('sin recargo (0%) devuelve los mismos montos', () => {
    const r = calculateSurchargedPricing({ lines: [{ unitPrice: 100, quantity: 2 }], percent: 0 })
    expect(r.baseSubtotal).toBe(200)
    expect(r.surchargedSubtotal).toBe(200)
    expect(r.surchargeAmount).toBe(0)
    expect(r.total).toBe(200)
    expect(r.unitPrices).toEqual([100])
  })

  it('aplica el recargo por unidad y multiplica por cantidad', () => {
    const r = calculateSurchargedPricing({ lines: [{ unitPrice: 10.15, quantity: 3 }], percent: 10 })
    expect(r.unitPrices).toEqual([11.17])
    expect(r.surchargedSubtotal).toBe(33.51) // 11.17*3, no round(30.45*1.1)=33.5
    expect(r.baseSubtotal).toBe(30.45)
    expect(r.surchargeAmount).toBe(3.06)
    expect(r.total).toBe(33.51)
  })

  it('suma varias líneas', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 1000, quantity: 1 }, { unitPrice: 250, quantity: 2 }],
      percent: 10,
    })
    expect(r.baseSubtotal).toBe(1500)
    expect(r.surchargedSubtotal).toBe(1650)
    expect(r.surchargeAmount).toBe(150)
    expect(r.total).toBe(1650)
  })

  it('cupón fijo: el recargo va después del cupón, (1000 - 200) x 1.10 = 880', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 1000, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'fixed_amount', value: 200 },
    })
    expect(r.surchargedSubtotal).toBe(1100)
    expect(r.discountTotal).toBe(200) // el cupón real que ve el cliente
    expect(r.dbDiscountTotal).toBe(220) // lo que descuenta la DB con el valor escalado
    expect(r.couponValue).toBe(220) // valor escalado a guardar en discount_metadata
    expect(r.total).toBe(880)
    expect(r.surchargeAmount).toBe(80)
  })

  it('cupón porcentual: (1000 - 20%) x 1.10 = 880 sin escalar el valor del cupón', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 1000, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'percentage', value: 20 },
    })
    expect(r.discountTotal).toBe(200)
    expect(r.dbDiscountTotal).toBe(220)
    expect(r.couponValue).toBe(20)
    expect(r.total).toBe(880)
    expect(r.surchargeAmount).toBe(80)
  })

  it('cupón fijo mayor al subtotal deja el total en 0 y sin recargo', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 100, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'fixed_amount', value: 500 },
    })
    expect(r.discountTotal).toBe(100)
    expect(r.dbDiscountTotal).toBe(110)
    expect(r.total).toBe(0)
    expect(r.surchargeAmount).toBe(0)
  })

  it('cupón fijo igual al subtotal deja el total en 0', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 100, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'fixed_amount', value: 100 },
    })
    expect(r.total).toBe(0)
  })

  it('sin cupón: recargo sobre el subtotal y couponValue null', () => {
    const r = calculateSurchargedPricing({ lines: [{ unitPrice: 1000, quantity: 1 }], percent: 10 })
    expect(r.discountTotal).toBe(0)
    expect(r.dbDiscountTotal).toBe(0)
    expect(r.couponValue).toBeNull()
    expect(r.total).toBe(1100)
    expect(r.surchargeAmount).toBe(100)
  })

  it('método sin recargo (0%) deja el cupón fijo intacto, sin escalar', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 1000, quantity: 1 }],
      percent: 0,
      coupon: { kind: 'fixed_amount', value: 200 },
    })
    expect(r.couponValue).toBe(200)
    expect(r.discountTotal).toBe(200)
    expect(r.dbDiscountTotal).toBe(200)
    expect(r.total).toBe(800)
    expect(r.surchargeAmount).toBe(0)
  })

  it('cupón fijo con centavos: el valor escalado se redondea a centavos', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 500, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'fixed_amount', value: 33.33 },
    })
    expect(r.couponValue).toBe(36.66) // 36.663
    expect(r.total).toBe(513.34) // 550 - 36.66
  })

  it('cupón fijo de S - 0.01: el cliente paga 0.01 x 1.10 redondeado, nunca queda negativo', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 100, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'fixed_amount', value: 99.99 },
    })
    expect(r.discountTotal).toBe(99.99)
    expect(r.couponValue).toBe(109.99) // 109.989
    expect(r.total).toBe(0.01)
    expect(r.surchargeAmount).toBe(0)
  })

  it('cupón porcentual mayor a 100 se capa y deja el total en 0', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 1000, quantity: 1 }],
      percent: 10,
      coupon: { kind: 'percentage', value: 150 },
    })
    expect(r.discountTotal).toBe(1000)
    expect(r.dbDiscountTotal).toBe(1100)
    expect(r.total).toBe(0)
    expect(r.surchargeAmount).toBe(0)
  })

  it('cupón porcentual con medio centavo redondea hacia arriba como la DB', () => {
    const r = calculateSurchargedPricing({
      lines: [{ unitPrice: 14.5, quantity: 1 }],
      percent: 0,
      coupon: { kind: 'percentage', value: 15 },
    })
    expect(r.discountTotal).toBe(2.18) // 2.175
    expect(r.total).toBe(12.32)
  })

  it('sin líneas devuelve ceros', () => {
    const r = calculateSurchargedPricing({ lines: [], percent: 10 })
    expect(r).toEqual({
      unitPrices: [],
      baseSubtotal: 0,
      surchargedSubtotal: 0,
      surchargeAmount: 0,
      discountTotal: 0,
      dbDiscountTotal: 0,
      couponValue: null,
      total: 0,
    })
  })

  it('línea con precio 0 no genera recargo', () => {
    const r = calculateSurchargedPricing({ lines: [{ unitPrice: 0, quantity: 5 }], percent: 10 })
    expect(r.surchargeAmount).toBe(0)
    expect(r.total).toBe(0)
  })
})
