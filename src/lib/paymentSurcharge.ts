import { calculateCouponDiscountAmount, roundMoney, type StoreCouponKind } from '@/lib/coupons'

// Lives in the client because the shared backend has no surcharge field:
// the surcharge is baked into each order_item's base_unit_price.
export const MERCADOPAGO_SURCHARGE_PERCENT = 10

export function getSurchargePercent(paymentMethod: string | null | undefined): number {
  return paymentMethod === 'mercadopago' ? MERCADOPAGO_SURCHARGE_PERCENT : 0
}

export function applySurcharge(amount: number | null | undefined, percent: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 0
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0
  return roundMoney(amount * (1 + safePercent / 100))
}

/** Inverso de applySurcharge para mostrar precios sin recargo; puede diferir 1 centavo por redondeo. */
export function removeSurcharge(amount: number | null | undefined, percent: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 0
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0
  return roundMoney(amount / (1 + safePercent / 100))
}

export interface SurchargeLine {
  unitPrice: number
  quantity: number
}

export interface SurchargedPricingInput {
  lines: SurchargeLine[]
  percent: number
  coupon?: { kind: StoreCouponKind; value: number } | null
}

export interface SurchargedPricing {
  /** Precio unitario con recargo por línea, a enviar como base_unit_price/price. */
  unitPrices: number[]
  /** Subtotal sin recargo (S). */
  baseSubtotal: number
  /** Subtotal con recargo, lo que la DB suma desde base_unit_price (S'). */
  surchargedSubtotal: number
  /** Cupón real que ve el cliente, calculado sobre el subtotal sin recargo (D). */
  discountTotal: number
  /** Descuento que aplica la DB sobre el subtotal recargado (D'). */
  dbDiscountTotal: number
  /** Valor a guardar en discount_metadata: escalado si el cupón es fijo y hay recargo; null sin cupón. */
  couponValue: number | null
  /** Total final menos (S - D): lo que se suma por pagar con recargo. */
  surchargeAmount: number
  total: number
}

/**
 * Replica el cálculo de la DB para que el total del resumen coincida con orders.total.
 * El recargo va siempre después del cupón: (S - D) x 1.10. La DB resta el cupón del subtotal ya
 * recargado, así que un cupón fijo se escala por el mismo factor en discount_metadata.
 */
export function calculateSurchargedPricing({ lines, percent, coupon }: SurchargedPricingInput): SurchargedPricing {
  const unitPrices = lines.map((line) => applySurcharge(line.unitPrice, percent))
  const baseSubtotal = roundMoney(lines.reduce((sum, line) => sum + Math.max(0, line.unitPrice) * line.quantity, 0))
  const surchargedSubtotal = roundMoney(unitPrices.reduce((sum, price, i) => sum + price * lines[i].quantity, 0))

  const discountTotal = coupon ? calculateCouponDiscountAmount(coupon.kind, coupon.value, baseSubtotal) : 0
  const couponValue = !coupon
    ? null
    : coupon.kind === 'fixed_amount'
      ? applySurcharge(coupon.value, percent)
      : coupon.value
  const dbDiscountTotal = coupon && couponValue !== null
    ? calculateCouponDiscountAmount(coupon.kind, couponValue, surchargedSubtotal)
    : 0
  const total = Math.max(0, roundMoney(surchargedSubtotal - dbDiscountTotal))

  return {
    unitPrices,
    baseSubtotal,
    surchargedSubtotal,
    discountTotal,
    dbDiscountTotal,
    couponValue,
    surchargeAmount: roundMoney(total - (baseSubtotal - discountTotal)) + 0, // + 0 normaliza -0
    total,
  }
}
