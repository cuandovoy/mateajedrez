/**
 * Mapeo centralizado de color por estado (Tailwind class strings).
 *
 * Antes de este módulo, AdminOrders.tsx, AdminOrderDetail.tsx,
 * AdminCustomerDetail.tsx y CashSessionPayments.tsx reimplementaban por
 * separado el mismo mapeo estado de pedido -> color, y AdminTransfers.tsx
 * tenía su propio mapeo con un vocabulario de estados distinto. AdminInventory
 * y AdminReposicion también resolvían "nivel de stock" de forma inconsistente
 * (colores distintos para la misma condición `is_low_stock`, umbrales
 * distintos para `dias_stock`). Este archivo unifica ambos casos.
 */

/** Estados posibles de un pedido (`orders.status`). */
export type OrderStatus =
  | 'pending'
  | 'pending_allocation'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_allocation: 'bg-orange-100 text-orange-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const ORDER_STATUS_COLOR_DEFAULT = 'bg-gray-100 text-gray-800'

/**
 * Clase Tailwind (bg + text) para un estado de pedido.
 * Estado desconocido o `null` -> gris neutro.
 */
export function getOrderStatusColor(status: string | null | undefined): string {
  if (!status) return ORDER_STATUS_COLOR_DEFAULT
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? ORDER_STATUS_COLOR_DEFAULT
}

/** Estados posibles de una transferencia entre sucursales (`stock_transfers.status`). */
export type TransferStatus = 'completed' | 'cancelled' | 'in_transit' | 'pending'

const TRANSFER_STATUS_COLORS: Record<Exclude<TransferStatus, 'pending'>, string> = {
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  in_transit: 'bg-yellow-100 text-yellow-800',
}

const TRANSFER_STATUS_COLOR_DEFAULT = 'bg-blue-100 text-blue-800'

/**
 * Clase Tailwind (bg + text) para un estado de transferencia.
 * `pending`, `null` o cualquier estado no mapeado -> azul (comportamiento
 * histórico de AdminTransfers.tsx, donde "pending" no tenía entrada propia).
 */
export function getTransferStatusColor(status: string | null | undefined): string {
  if (!status) return TRANSFER_STATUS_COLOR_DEFAULT
  return (
    TRANSFER_STATUS_COLORS[status as Exclude<TransferStatus, 'pending'>] ??
    TRANSFER_STATUS_COLOR_DEFAULT
  )
}

/** Nivel de urgencia de stock, ya resuelto a partir de los datos crudos. */
export type StockLevel = 'ok' | 'low' | 'critical'

export interface StockLevelColorSet {
  /** Para texto destacado (ej: número de stock en una celda). */
  text: string
  /** Para resaltar el fondo de una fila o card completa. */
  bg: string
  /** Para un badge/pill combinado (bg + text). */
  badge: string
}

const STOCK_LEVEL_COLORS: Record<StockLevel, StockLevelColorSet> = {
  ok: { text: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
  low: { text: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  critical: { text: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
}

const STOCK_LEVEL_COLOR_DEFAULT = STOCK_LEVEL_COLORS.ok

/** Set de clases Tailwind (text/bg/badge) para un nivel de stock. */
export function getStockLevelColor(level: StockLevel): StockLevelColorSet {
  return STOCK_LEVEL_COLORS[level] ?? STOCK_LEVEL_COLOR_DEFAULT
}

/**
 * Resuelve el nivel de stock a partir del stock actual y el flag
 * `is_low_stock` que ya calcula AdminInventory. Sin stock (`stock <= 0`)
 * es siempre `critical`, aunque `is_low_stock` no lo distinga de `low`.
 */
export function getStockLevelFromFlags(params: { stock: number; isLowStock: boolean }): StockLevel {
  if (params.stock <= 0) return 'critical'
  if (params.isLowStock) return 'low'
  return 'ok'
}

/**
 * Resuelve el nivel de stock a partir de `dias_stock` (días de cobertura
 * estimados), como usa AdminReposicion. `null` significa "sin datos
 * suficientes para estimar" y se trata como `ok` (no se puede afirmar
 * urgencia sin datos).
 */
export function getStockLevelFromDays(diasStock: number | null | undefined): StockLevel {
  if (diasStock === null || diasStock === undefined) return 'ok'
  if (diasStock < 7) return 'critical'
  if (diasStock < 14) return 'low'
  return 'ok'
}
