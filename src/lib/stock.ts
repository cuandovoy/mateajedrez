import { supabase } from './supabase'

const NETWORK_RETRIES = 1
const RETRY_DELAY_MS = 250

function isNetworkFetchError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : ''
  return message.toLowerCase().includes('failed to fetch')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Gets stock for a product.
 * Uses SECURITY DEFINER RPC — works for anonymous (public store) users.
 */
export async function getProductStock(
  productId: string,
  variantId?: string | null,
  branchId?: string | null,
  organizationId?: string | null
): Promise<number> {
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_product_stock', {
        p_product_id: productId,
        p_variant_id: variantId || null,
        p_branch_id: branchId || null,
        p_organization_id: organizationId || null,
      })

      if (error) {
        if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        console.error('Error getting product stock:', error)
        return 0
      }

      return Number(data || 0)
    } catch (error) {
      if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      console.error('Error getting product stock:', error)
      return 0
    }
  }
  return 0
}

/**
 * Gets stock for multiple products at once (optimized for listings).
 * Uses SECURITY DEFINER RPC — works for anonymous (public store) users.
 */
export async function getProductsStock(
  productIds: string[],
  branchId?: string | null,
  organizationId?: string | null
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}

  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_products_stock', {
        p_product_ids: productIds,
        p_branch_id: branchId || null,
        p_organization_id: organizationId || null,
      })

      if (error) {
        if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        console.error('Error getting products stock:', error)
        return {}
      }

      const stockMap: Record<string, number> = {}
      if (data) {
        for (const item of data) {
          const key = item.product_id
          if (key) {
            stockMap[key] = Math.max(stockMap[key] || 0, item.stock || 0)
          }
        }
      }

      return stockMap
    } catch (error) {
      if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      console.error('Error getting products stock:', error)
      return {}
    }
  }
  return {}
}

/**
 * Reordena productos poniendo primero los que tienen stock disponible.
 * Mantiene el orden relativo original dentro de cada grupo (con/sin stock).
 */
export function sortByStockFirst<T extends { id: string }>(
  products: T[],
  stockByProduct: Record<string, number>
): T[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const aHasStock = (stockByProduct[a.product.id] ?? 0) > 0
      const bHasStock = (stockByProduct[b.product.id] ?? 0) > 0
      if (aHasStock === bHasStock) return a.index - b.index
      return aHasStock ? -1 : 1
    })
    .map(({ product }) => product)
}

const cachedBranchByKey = new Map<string, string>()

interface StorefrontBranchOptions {
  /** Applies only to the legacy resolution steps inside the RPC (see SaaS migration 171). */
  excludeIsolatedWarehouses?: boolean
}

async function resolveBranchLegacy(organizationId: string, excludeIsolated: boolean): Promise<string | null> {
  const base = () => {
    let q = supabase
      .from('branches')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
    if (excludeIsolated) q = q.eq('is_isolated_warehouse', false)
    return q
  }

  const { data: main, error } = await base().eq('code', 'MAIN')
  if (error) throw error
  if (Array.isArray(main) && main[0]) return (main[0] as { id: string }).id

  const { data: first } = await base()
  return Array.isArray(first) && first[0] ? (first[0] as { id: string }).id : null
}

/**
 * Single entry point for "which branch serves the online store".
 * Delegates to the SaaS-owned RPC resolve_storefront_branch_id (explicit
 * organizations.storefront_branch_id, then code=MAIN, then first active branch).
 * The legacy client-side query is only a fallback when the RPC itself fails.
 */
export async function getStorefrontBranchId(
  organizationId?: string | null,
  options: StorefrontBranchOptions = {}
): Promise<string | null> {
  if (!organizationId) return null
  const exclude = options.excludeIsolatedWarehouses ?? true
  const cacheKey = `${organizationId}:${exclude}`
  const cached = cachedBranchByKey.get(cacheKey)
  if (cached) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('resolve_storefront_branch_id', {
      p_organization_id: organizationId,
      p_exclude_isolated_warehouses: exclude,
    })
    if (error) throw error
    if (typeof data === 'string' && data) {
      cachedBranchByKey.set(cacheKey, data)
      return data
    }
    return null
  } catch (rpcError) {
    console.error('Error resolving storefront branch via RPC, using legacy fallback:', rpcError)
  }

  try {
    const legacy = await resolveBranchLegacy(organizationId, exclude)
    if (legacy) cachedBranchByKey.set(cacheKey, legacy)
    return legacy
  } catch (error) {
    console.error('Error fetching storefront branch:', error)
    return null
  }
}
