import { supabase } from './supabase'

const NETWORK_RETRIES = 1
const RETRY_DELAY_MS = 250
const cachedNonIsolatedBranchIdsByOrg = new Map<string, string[]>()

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

async function getStockFallback(
  productId: string,
  variantId?: string | null,
  branchId?: string | null,
  organizationId?: string | null
): Promise<number> {
  let query = supabase.from('branch_inventory').select('stock')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  } else if (organizationId) {
    const branchIds = await getNonIsolatedBranchIds(organizationId)
    if (branchIds.length === 0) return 0
    query = query.in('branch_id', branchIds)
  }

  if (variantId) {
    query = query.eq('variant_id', variantId)
  } else {
    query = query.eq('product_id', productId).is('variant_id', null)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data || []) as Array<{ stock: number | null }>
  return rows.reduce((sum, row) => sum + Number(row.stock || 0), 0)
}

async function getNonIsolatedBranchIds(organizationId?: string | null): Promise<string[]> {
  if (!organizationId) return []

  const cacheKey = organizationId
  if (cachedNonIsolatedBranchIdsByOrg.has(cacheKey)) {
    return cachedNonIsolatedBranchIdsByOrg.get(cacheKey) || []
  }

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('is_isolated_warehouse', false)
    .order('created_at', { ascending: true })

  if (error) throw error

  const branchIds = ((data || []) as Array<{ id: string }>).map((row) => row.id)
  cachedNonIsolatedBranchIdsByOrg.set(cacheKey, branchIds)
  return branchIds
}

async function getProductStockAcrossNonIsolatedBranches(
  productId: string,
  variantId?: string | null,
  organizationId?: string | null
): Promise<number> {
  const branchIds = await getNonIsolatedBranchIds(organizationId)
  if (branchIds.length === 0) return 0

  if (variantId) {
    const { data, error } = await supabase
      .from('branch_inventory')
      .select('stock')
      .in('branch_id', branchIds)
      .eq('variant_id', variantId)
      .is('product_id', null)

    if (error) throw error
    return ((data || []) as Array<{ stock: number | null }>).reduce((sum, row) => sum + Number(row.stock || 0), 0)
  }

  // Keep same behavior as get_product_stock RPC:
  // use DEFAULT variant when present, otherwise product-level stock when product has no active variants.
  const { data: defaultVariant, error: defaultVariantError } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .like('sku', '%-DEFAULT')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (defaultVariantError) throw defaultVariantError

  if (defaultVariant?.id) {
    const { data, error } = await supabase
      .from('branch_inventory')
      .select('stock')
      .in('branch_id', branchIds)
      .eq('variant_id', defaultVariant.id)
      .is('product_id', null)

    if (error) throw error
    return ((data || []) as Array<{ stock: number | null }>).reduce((sum, row) => sum + Number(row.stock || 0), 0)
  }

  const { count: activeVariantsCount, error: activeVariantsError } = await supabase
    .from('product_variants')
    .select('id', { head: true, count: 'exact' })
    .eq('product_id', productId)
    .eq('is_active', true)

  if (activeVariantsError) throw activeVariantsError
  if ((activeVariantsCount || 0) > 0) return 0

  const { data, error } = await supabase
    .from('branch_inventory')
    .select('stock')
    .in('branch_id', branchIds)
    .eq('product_id', productId)
    .is('variant_id', null)

  if (error) throw error
  return ((data || []) as Array<{ stock: number | null }>).reduce((sum, row) => sum + Number(row.stock || 0), 0)
}

async function getProductsStockAcrossNonIsolatedBranches(
  productIds: string[],
  organizationId?: string | null
): Promise<Record<string, number>> {
  const branchIds = await getNonIsolatedBranchIds(organizationId)
  if (branchIds.length === 0) return {}

  const stockMap: Record<string, number> = {}

  const { data: productInventoryData, error: productInventoryError } = await supabase
    .from('branch_inventory')
    .select('product_id, stock')
    .in('branch_id', branchIds)
    .in('product_id', productIds)
    .is('variant_id', null)

  if (productInventoryError) throw productInventoryError

  for (const row of (productInventoryData || []) as Array<{ product_id: string | null; stock: number | null }>) {
    if (!row.product_id) continue
    stockMap[row.product_id] = (stockMap[row.product_id] || 0) + Number(row.stock || 0)
  }

  const { data: variantsData, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, product_id')
    .in('product_id', productIds)
    .eq('is_active', true)

  if (variantsError) throw variantsError

  if (variantsData && variantsData.length > 0) {
    const variantIds = variantsData.map((variant) => variant.id)
    const productIdByVariant = new Map<string, string>()

    variantsData.forEach((variant) => {
      productIdByVariant.set(variant.id, variant.product_id)
    })

    const { data: variantInventoryData, error: variantInventoryError } = await supabase
      .from('branch_inventory')
      .select('variant_id, stock')
      .in('branch_id', branchIds)
      .in('variant_id', variantIds)
      .not('variant_id', 'is', null)

    if (variantInventoryError) throw variantInventoryError

    for (const row of (variantInventoryData || []) as Array<{ variant_id: string | null; stock: number | null }>) {
      const variantId = row.variant_id
      if (!variantId) continue
      const productId = productIdByVariant.get(variantId)
      if (!productId) continue
      stockMap[productId] = (stockMap[productId] || 0) + Number(row.stock || 0)
    }
  }

  return stockMap
}

/**
 * Gets stock for a product from branch_inventory
 * Handles variants automatically (checks for default variant or product-level inventory)
 */
export async function getProductStock(
  productId: string,
  variantId?: string | null,
  branchId?: string | null,
  organizationId?: string | null
): Promise<number> {
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      if (!branchId && organizationId) {
        return await getProductStockAcrossNonIsolatedBranches(productId, variantId, organizationId)
      }

      // Type assertion needed because PostgREST types may not be updated after migration 027
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_product_stock', {
        p_product_id: productId,
        p_variant_id: variantId || null,
        p_branch_id: branchId || null,
      })

      if (error) {
        if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        // Fallback when RPC fails (network/schema cache/RLS edge cases)
        return await getStockFallback(productId, variantId, branchId, organizationId)
      }

      return Number(data || 0)
    } catch (error) {
      if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      try {
        return await getStockFallback(productId, variantId, branchId, organizationId)
      } catch (fallbackError) {
        console.error('Error getting product stock (rpc + fallback):', {
          rpcError: error,
          fallbackError,
          productId,
          variantId,
          branchId,
          organizationId,
        })
        return 0
      }
    }
  }
  return 0
}

/**
 * Gets stock for multiple products at once (optimized for listings)
 */
export async function getProductsStock(
  productIds: string[],
  branchId?: string | null,
  organizationId?: string | null
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}

  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      if (!branchId && organizationId) {
        return await getProductsStockAcrossNonIsolatedBranches(productIds, organizationId)
      }

      const effectiveBranchId = branchId || (await getMainBranchId(organizationId))

      // Type assertion needed because PostgREST types may not be updated after migration 027
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_products_stock', {
        p_product_ids: productIds,
        p_branch_id: effectiveBranchId || null,
      })

      if (error) {
        if (attempt < NETWORK_RETRIES && isNetworkFetchError(error)) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        console.error('Error getting products stock:', error)
        return {}
      }

      // Convert array to record: product_id -> stock
      // Important: listings always consume stock by product.id.
      const stockMap: Record<string, number> = {}
      if (data) {
        for (const item of data) {
          const productKey = item.product_id
          if (productKey) {
            // Multiple rows for same product may exist (e.g. product row + default variant row).
            // Keep the highest available stock to avoid false "sin stock" in listings.
            stockMap[productKey] = Math.max(stockMap[productKey] || 0, item.stock || 0)
          }
        }
      }

      // Complement with variant stock aggregation.
      // Needed when product has variants without DEFAULT sku:
      // listing must still show stock if any active variant has stock.
      if (effectiveBranchId) {
        const { data: variantsData, error: variantsError } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .in('product_id', productIds)
          .eq('is_active', true)

        if (!variantsError && variantsData && variantsData.length > 0) {
          const variantIds = variantsData.map((variant) => variant.id)
          const productIdByVariant = new Map<string, string>()
          variantsData.forEach((variant) => {
            productIdByVariant.set(variant.id, variant.product_id)
          })

          const { data: variantInventoryData, error: variantInventoryError } = await supabase
            .from('branch_inventory')
            .select('variant_id, stock')
            .eq('branch_id', effectiveBranchId)
            .in('variant_id', variantIds)
            .not('variant_id', 'is', null)

          if (!variantInventoryError && variantInventoryData) {
            for (const row of variantInventoryData) {
              const variantId = row.variant_id as string | null
              if (!variantId) continue
              const productId = productIdByVariant.get(variantId)
              if (!productId) continue
              const previous = stockMap[productId] || 0
              stockMap[productId] = previous + Number(row.stock || 0)
            }
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

    // Fallback: get first active branch
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
