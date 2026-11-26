import { DELIVERY_METHODS, type DeliveryMethod } from '@/lib/schemas'

// Borrador del checkout: solo datos no sensibles. Cupón y token de recaptcha
// quedan afuera a propósito (el cupón se revalida y el token vence).
export interface CheckoutDraft {
  deliveryMethod?: DeliveryMethod
  fullName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  department?: string
  paymentMethod?: string
}

export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const MAX_FIELD_LENGTH = 500
const TEXT_FIELDS = ['fullName', 'email', 'phone', 'address', 'city', 'department', 'paymentMethod'] as const

export function checkoutDraftKey(organizationId: string): string {
  return `checkout_draft_${organizationId}`
}

export function serializeCheckoutDraft(draft: CheckoutDraft): string {
  const clean: CheckoutDraft = {}
  if (draft.deliveryMethod) clean.deliveryMethod = draft.deliveryMethod
  for (const field of TEXT_FIELDS) {
    const value = draft[field]
    if (typeof value === 'string') clean[field] = value
  }
  return JSON.stringify(clean)
}

export function parseCheckoutDraft(raw: string | null): CheckoutDraft | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null

  const source = data as Record<string, unknown>
  const draft: CheckoutDraft = {}
  if (typeof source.deliveryMethod === 'string' && (DELIVERY_METHODS as readonly string[]).includes(source.deliveryMethod)) {
    draft.deliveryMethod = source.deliveryMethod as DeliveryMethod
  }
  for (const field of TEXT_FIELDS) {
    const value = source[field]
    if (typeof value === 'string') draft[field] = value.slice(0, MAX_FIELD_LENGTH)
  }
  return Object.keys(draft).length > 0 ? draft : null
}

// El email puede venir precargado desde la sesión, por eso no cuenta como "tocado".
export function isCheckoutFormPristine(values: CheckoutDraft): boolean {
  return (['fullName', 'phone', 'address', 'city', 'department'] as const).every(
    (field) => !values[field]?.trim(),
  )
}

function resolveStorage(storage?: DraftStorage | null): DraftStorage | null {
  if (storage !== undefined) return storage
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function loadCheckoutDraft(organizationId: string, storage?: DraftStorage | null): CheckoutDraft | null {
  const target = resolveStorage(storage)
  if (!target) return null
  try {
    return parseCheckoutDraft(target.getItem(checkoutDraftKey(organizationId)))
  } catch {
    return null
  }
}

export function saveCheckoutDraft(organizationId: string, draft: CheckoutDraft, storage?: DraftStorage | null): void {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    target.setItem(checkoutDraftKey(organizationId), serializeCheckoutDraft(draft))
  } catch {
    // Storage lleno o bloqueado: el borrador es un extra, no debe romper el checkout.
  }
}

export function clearCheckoutDraft(organizationId: string, storage?: DraftStorage | null): void {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    target.removeItem(checkoutDraftKey(organizationId))
  } catch {
    // Ver saveCheckoutDraft.
  }
}
