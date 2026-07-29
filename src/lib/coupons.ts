import type { StoreCoupon } from '@/types'
import type { Json } from '@/types/database.types'

export type StoreCouponKind = 'fixed_amount' | 'percentage'

export interface CouponDiscountMetadata {
  source: 'coupon'
  coupon_id: string
  code: string
  kind: StoreCouponKind
  value: number
  applied_amount: number
  valid_until: string
  applied_at: string
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function calculateCouponDiscountAmount(kind: StoreCouponKind, value: number, subtotal: number): number {
  const normalizedSubtotal = Math.max(0, subtotal)
  const normalizedValue = Math.max(0, value)

  const rawDiscount =
    kind === 'percentage'
      ? normalizedSubtotal * Math.min(normalizedValue, 100) / 100
      : normalizedValue

  return roundMoney(Math.min(normalizedSubtotal, rawDiscount))
}

export function buildCouponDiscountMetadata(
  coupon: Pick<StoreCoupon, 'id' | 'code' | 'kind' | 'amount' | 'valid_until'>,
  appliedAmount: number,
  appliedAt = new Date().toISOString(),
): Json {
  return {
    source: 'coupon',
    coupon_id: coupon.id,
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.amount,
    applied_amount: appliedAmount,
    valid_until: coupon.valid_until,
    applied_at: appliedAt,
  } satisfies CouponDiscountMetadata
}

export function isCouponDiscountMetadata(value: unknown): value is CouponDiscountMetadata {
  if (!value || typeof value !== 'object') return false
  const metadata = value as Partial<CouponDiscountMetadata>
  return metadata.source === 'coupon'
    && typeof metadata.coupon_id === 'string'
    && typeof metadata.code === 'string'
    && (metadata.kind === 'fixed_amount' || metadata.kind === 'percentage')
    && typeof metadata.value === 'number'
    && typeof metadata.applied_amount === 'number'
    && typeof metadata.valid_until === 'string'
    && typeof metadata.applied_at === 'string'
}
