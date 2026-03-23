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

const cachedMainBranchByOrg = new Map<string, string | null>()

export async function getMainBranchId(organizationId?: string | null): Promise<string | null> {
  const cacheKey = organizationId || '__global__'
  if (cachedMainBranchByOrg.has(cacheKey)) {
    return cachedMainBranchByOrg.get(cacheKey) ?? null
  }

  try {
    let mainQuery = supabase
      .from('branches')
      .select('id')
      .eq('code', 'MAIN')
      .eq('is_active', true)
      .eq('is_isolated_warehouse', false)
      .order('created_at', { ascending: true })
      .limit(1)

    if (organizationId) {
      mainQuery = mainQuery.eq('organization_id', organizationId)
    }

    const { data, error } = await mainQuery

    if (error) throw error
    const mainRow = Array.isArray(data) ? data[0] : null
    if (mainRow) {
      const branchId = (mainRow as { id: string }).id
      cachedMainBranchByOrg.set(cacheKey, branchId)
      return branchId
    }

    let fallbackQuery = supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .eq('is_isolated_warehouse', false)
      .order('created_at', { ascending: true })
      .limit(1)

    if (organizationId) {
      fallbackQuery = fallbackQuery.eq('organization_id', organizationId)
    }

    const { data: fallbackData } = await fallbackQuery

    const fallbackRow = Array.isArray(fallbackData) ? fallbackData[0] : null
    if (fallbackRow) {
      const branchId = (fallbackRow as { id: string }).id
      cachedMainBranchByOrg.set(cacheKey, branchId)
      return branchId
    }

    cachedMainBranchByOrg.set(cacheKey, null)
    return null
  } catch (error) {
    console.error('Error fetching main branch:', error)
    return null
  }
}
