export interface ProductStoreFlags {
  id?: string
  is_active?: boolean | null
  visible_in_store?: boolean | null
  requires_availability_check?: boolean | null
}

export type BlockedReason = 'inquiry' | 'hidden' | 'inactive' | 'missing'

export interface BlockedCartItem {
  itemId: string
  productId: string
  name: string
  reason: BlockedReason
}

interface GuardCartItem {
  id: string
  product_id: string
  name: string
}

function getBlockReason(flags: ProductStoreFlags | undefined | null): BlockedReason | null {
  if (!flags) return 'missing'
  if (flags.is_active !== true) return 'inactive'
  // undefined = row fetched without the column (legacy select); null fails closed.
  if (flags.visible_in_store !== undefined && flags.visible_in_store !== true) return 'hidden'
  if (flags.requires_availability_check === true) return 'inquiry'
  return null
}

/** Whether a product can be shown and bought in the public online store. */
export function isProductPurchasableInStore(product: ProductStoreFlags | null | undefined): boolean {
  return getBlockReason(product) === null
}

/**
 * Cart items that cannot be ordered online given the products' current flags.
 * A product absent from `products` is treated as `missing` (deleted, or hidden by RLS).
 */
export function findBlockedCartItems(items: GuardCartItem[], products: ProductStoreFlags[]): BlockedCartItem[] {
  const byId = new Map<string, ProductStoreFlags>()
  for (const p of products) if (p.id) byId.set(p.id, p)

  const blocked: BlockedCartItem[] = []
  for (const item of items) {
    const reason = getBlockReason(byId.get(item.product_id))
    if (reason) blocked.push({ itemId: item.id, productId: item.product_id, name: item.name, reason })
  }
  return blocked
}

export function blockedReasonMessage(reason: BlockedReason): string {
  switch (reason) {
    case 'inquiry':
      return 'Este producto es a encargar. Consultá su disponibilidad con la tienda antes de comprar.'
    case 'hidden':
    case 'inactive':
    case 'missing':
      return 'Este producto no está disponible en la tienda. Quitalo del carrito para continuar.'
  }
}

/**
 * Friendly message for the CHECK violation (23514) raised by the order_items
 * triggers owned by the SaaS schema. Null when the error is not a known one.
 */
export function mapOrderItemsInsertError(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error || error.code !== '23514') return null
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('disponibilidad')) {
    return 'Algún producto de tu carrito es a encargar. Consultá su disponibilidad con la tienda antes de comprar.'
  }
  if (message.includes('no disponible')) {
    return 'Algún producto de tu carrito ya no está disponible en la tienda. Quitalo para continuar.'
  }
  return 'No se pudo procesar el pedido. Revisá los productos de tu carrito e intentá de nuevo.'
}
