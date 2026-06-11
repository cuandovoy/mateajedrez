import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getProductsStock } from '@/lib/stock'
import { queryKeys } from '@/lib/queryKeys'
import type { Product, ProductImage } from '@/types'

export type ProductWithImages = Product & { product_images?: ProductImage[] }

export interface ProductsPage {
  products: Product[]
  stockByProduct: Record<string, number>
  hasVariantsByProduct: Record<string, boolean>
  hasMore: boolean
}

export interface ProductFilters {
  categoryId?: string
  minPrice?: string
  maxPrice?: string
  search?: string
  page?: number
  pageSize?: number
}

// ─── Hook para PublicStore (home): todos los productos activos, sin filtros ───

async function fetchStoreProducts(organizationId: string): Promise<ProductWithImages[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_images (
        id,
        image_url,
        display_order,
        is_primary,
        product_id,
        created_at,
        updated_at
      )
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export function useStoreProducts(organizationId: string) {
  return useQuery({
    queryKey: queryKeys.store.products(organizationId),
    queryFn: () => fetchStoreProducts(organizationId),
    enabled: !!organizationId,
    staleTime: 3 * 60 * 1000,
  })
}

// ─── Hook para Products.tsx: paginado + filtros + stock ───

const PAGE_SIZE = 24

async function fetchFilteredProducts(
  organizationId: string,
  filters: Required<ProductFilters>,
): Promise<ProductsPage> {
  const { categoryId, minPrice, maxPrice, search, page, pageSize } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize // fetch uno extra para saber si hay más

  let query = supabase
    .from('products')
    .select(`
      *,
      product_images (
        id,
        image_url,
        display_order,
        is_primary
      )
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (categoryId) query = query.eq('category_id', categoryId)
  if (minPrice) query = query.gte('price', parseFloat(minPrice))
  if (maxPrice) query = query.lte('price', parseFloat(maxPrice))
  if (search) {
    const safe = search.toLowerCase().replace(/[%]/g, '').replace(/,/g, ' ').trim()
    if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,sku.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as Product[]
  const hasMore = rows.length > pageSize
  const products = hasMore ? rows.slice(0, pageSize) : rows
  const productIds = products.map((p) => p.id)

  const [stockByProduct, variantsResult] = await Promise.all([
    productIds.length > 0 ? getProductsStock(productIds, null, organizationId) : Promise.resolve({}),
    productIds.length > 0
      ? supabase.from('product_variants').select('product_id').in('product_id', productIds).eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
  ])

  const hasVariantsByProduct: Record<string, boolean> = {}
  if (!variantsResult.error && variantsResult.data) {
    for (const row of variantsResult.data as Array<{ product_id: string }>) {
      hasVariantsByProduct[row.product_id] = true
    }
  }

  return { products, stockByProduct, hasVariantsByProduct, hasMore }
}

export function useFilteredProducts(organizationId: string | null, filters: ProductFilters) {
  const normalizedFilters: Required<ProductFilters> = {
    categoryId: filters.categoryId ?? '',
    minPrice: filters.minPrice ?? '',
    maxPrice: filters.maxPrice ?? '',
    search: filters.search ?? '',
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? PAGE_SIZE,
  }

  return useQuery({
    queryKey: queryKeys.store.filteredProducts(organizationId!, normalizedFilters),
    queryFn: () => fetchFilteredProducts(organizationId!, normalizedFilters),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}
