export const PAGE_SIZE_STORE = 24
export const PAGE_SIZE_ADMIN = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export const ACTIVE_ORDER_STATUSES = [
  'pending_allocation',
  'pending',
  'processing',
  'shipped',
  'delivered',
] as const
