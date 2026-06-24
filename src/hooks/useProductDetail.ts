import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { getEffectivePrice } from '@/lib/utils'
import type { ProductMovementRow } from '@/types'

// ─── Shared option type used by section hooks ──────────────────────────────

interface SectionQueryOptions {
  enabled?: boolean
}

// ─── 2.1 useProductHeader ──────────────────────────────────────────────────

export function useProductHeader(orgId: string | null, productId: string | null) {
  return useQuery({
    queryKey: queryKeys.products.header(orgId!, productId!),
    queryFn: async () => {
      const [productResult, inventoryResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, is_active, price, discount_percentage, discount_expires_at, image_url, organization_id')
          .eq('id', productId!)
          .eq('organization_id', orgId!)
          .single(),
        supabase
          .from('branch_inventory')
          .select('stock, avg_unit_cost, branch_id, branch:branches!inner(organization_id)')
          .eq('product_id', productId!)
          .eq('branches.organization_id', orgId!),
      ])

      if (productResult.error) throw productResult.error
      if (inventoryResult.error) throw inventoryResult.error

      const product = productResult.data
      const rows = inventoryResult.data ?? []

      const totalStock = rows.reduce((sum, r) => sum + (r.stock ?? 0), 0)

      const weightedAvgCost =
        totalStock > 0
          ? rows.reduce((sum, r) => sum + (r.stock ?? 0) * (r.avg_unit_cost ?? 0), 0) / totalStock
          : null

      const effectivePrice = getEffectivePrice(product)

      const currentMargin =
        effectivePrice > 0 && weightedAvgCost !== null
          ? ((effectivePrice - weightedAvgCost) / effectivePrice) * 100
          : null

      return { product, totalStock, weightedAvgCost, currentMargin, effectivePrice }
    },
    enabled: !!orgId && !!productId,
    staleTime: 3 * 60 * 1000,
  })
}

// ─── 2.2 useProductStockByBranch ──────────────────────────────────────────

export function useProductStockByBranch(
  orgId: string | null,
  productId: string | null,
  opts: SectionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.products.stockByBranch(orgId!, productId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branch_inventory')
        .select('*, branch:branches!inner(id, name, organization_id)')
        .eq('product_id', productId!)
        .eq('branches.organization_id', orgId!)
        .order('branch_id', { ascending: true })

      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && !!productId && (opts.enabled ?? true),
  })
}

// ─── 2.3 useProductMovements ──────────────────────────────────────────────

export interface ProductMovementsResult {
  rows: ProductMovementRow[]
  totalCount: number
  degraded: boolean
}

export function useProductMovements(
  orgId: string | null,
  productId: string | null,
  page: number,
  movementType?: string,
  opts: SectionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.products.movements(orgId!, productId!, page, movementType),
    queryFn: async (): Promise<ProductMovementsResult> => {
      try {
        const params: Record<string, unknown> = {
          p_product_id: productId!,
          p_organization_id: orgId!,
          p_limit: PAGE_SIZE_ADMIN,
          p_offset: page * PAGE_SIZE_ADMIN,
        }
        if (movementType) params.p_movement_type = movementType

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('get_product_movements', params)

        if (error) {
          // Degraded mode: RPC not yet applied by user
          if (
            error.code === 'PGRST202' ||
            error.message?.toLowerCase().includes('does not exist') ||
            error.message?.toLowerCase().includes('function') ||
            error.code === '42883'
          ) {
            return { rows: [], totalCount: 0, degraded: true }
          }
          throw error
        }

        const rows: ProductMovementRow[] = data ?? []
        const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0
        return { rows, totalCount, degraded: false }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        if (
          e?.code === 'PGRST202' ||
          e?.code === '42883' ||
          e?.message?.toLowerCase().includes('does not exist')
        ) {
          return { rows: [], totalCount: 0, degraded: true }
        }
        throw err
      }
    },
    enabled: !!orgId && !!productId && (opts.enabled ?? true),
    placeholderData: (prev) => prev,
  })
}

// ─── 2.4 useProductTransfers ──────────────────────────────────────────────

export function useProductTransfers(
  orgId: string | null,
  productId: string | null,
  opts: SectionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.products.detailTransfers(orgId!, productId!),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data, error } = await sb
        .from('inventory_transfers')
        .select('*, from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name)')
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && !!productId && (opts.enabled ?? true),
  })
}

// ─── 2.5 useProductPurchaseItems ──────────────────────────────────────────

export function useProductPurchaseItems(
  orgId: string | null,
  productId: string | null,
  opts: SectionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.products.purchaseItems(orgId!, productId!),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data, error } = await sb
        .from('purchase_order_items')
        .select(
          '*, purchase_order:purchase_orders(id, created_at, status, organization_id, order_number, supplier:suppliers(name))'
        )
        .eq('product_id', productId!)
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && !!productId && (opts.enabled ?? true),
  })
}

// ─── 2.6 useProductSales ──────────────────────────────────────────────────

export interface ProductSalesResult {
  rows: unknown[]
  totalCount: number
}

export function useProductSales(
  orgId: string | null,
  productId: string | null,
  page: number,
  opts: SectionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.products.sales(orgId!, productId!, page),
    queryFn: async (): Promise<ProductSalesResult> => {
      const from = page * PAGE_SIZE_ADMIN
      const to = from + PAGE_SIZE_ADMIN - 1

      const { data, error, count } = await supabase
        .from('order_items')
        .select(
          '*, order:orders(id, order_number, created_at, status, organization_id, branch_id, branch:branches(name))',
          { count: 'exact' }
        )
        .eq('product_id', productId!)
        .eq('order.organization_id', orgId!)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      return { rows: data ?? [], totalCount: count ?? 0 }
    },
    enabled: !!orgId && !!productId && (opts.enabled ?? true),
    placeholderData: (prev) => prev,
  })
}

// ─── 2.7 useProductSuppliers ──────────────────────────────────────────────

export function useProductSuppliers(
  orgId: string | null,
  productId: string | null,
  opts: SectionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.products.detailSuppliers(orgId!, productId!),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data, error } = await sb
        .from('product_suppliers')
        .select('*, supplier:suppliers(id, name)')
        .eq('product_id', productId!)
        .order('is_primary', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && !!productId && (opts.enabled ?? true),
  })
}
