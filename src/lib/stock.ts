import { supabase } from './supabase'

/**
 * Gets stock for a product from branch_inventory
 * Handles variants automatically (checks for default variant or product-level inventory)
 */
export async function getProductStock(
  productId: string,
  variantId?: string | null,
  branchId?: string | null
): Promise<number> {
  try {
    // Type assertion needed because PostgREST types may not be updated after migration 027
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_product_stock', {
      p_product_id: productId,
      p_variant_id: variantId || null,
      p_branch_id: branchId || null,
    })

    if (error) {
      console.error('Error getting product stock:', error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error('Error getting product stock:', error)
    return 0
  }
}

/**
 * Gets stock for multiple products at once (optimized for listings)
 */
export async function getProductsStock(
  productIds: string[],
  branchId?: string | null
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}

  try {
    // Type assertion needed because PostgREST types may not be updated after migration 027
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_products_stock', {
      p_product_ids: productIds,
      p_branch_id: branchId || null,
    })

    if (error) {
      console.error('Error getting products stock:', error)
      return {}
    }

    // Convert array to record: product_id -> stock
    const stockMap: Record<string, number> = {}
    if (data) {
      for (const item of data) {
        const key = item.variant_id || item.product_id
        if (key) {
          // If multiple entries for same product, take the max (shouldn't happen, but just in case)
          stockMap[key] = Math.max(stockMap[key] || 0, item.stock || 0)
        }
      }
    }

    return stockMap
  } catch (error) {
    console.error('Error getting products stock:', error)
    return {}
  }
}

/**
 * Gets the main branch ID (cached)
 */
let cachedMainBranchId: string | null = null

export async function getMainBranchId(): Promise<string | null> {
  if (cachedMainBranchId) {
    return cachedMainBranchId
  }

  try {
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('code', 'MAIN')
      .eq('is_active', true)
      .single()

    if (error) throw error
    if (data) {
      cachedMainBranchId = (data as { id: string }).id
      return (data as { id: string }).id
    }

    // Fallback: get first active branch
    const { data: fallbackData } = await supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (fallbackData) {
      cachedMainBranchId = (fallbackData as { id: string }).id
      return (fallbackData as { id: string }).id
    }

    return null
  } catch (error) {
    console.error('Error fetching main branch:', error)
    return null
  }
}
