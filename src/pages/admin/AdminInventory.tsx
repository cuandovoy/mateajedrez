import { InventoryAdjustmentModal } from '@/components/admin/InventoryAdjustmentModal'
import { InventoryMovementsModal } from '@/components/admin/InventoryMovementsModal'
import { InventoryReceiptModal } from '@/components/admin/InventoryReceiptModal'
import { InventoryTransferModal } from '@/components/admin/InventoryTransferModal'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { trackAuditAction } from '@/lib/audit'
import { capitalizeFirst } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  History,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const EXPORT_BATCH_SIZE = 1000

interface InventoryItem {
  id: string
  branch_id: string
  branch_name: string
  product_id: string | null
  variant_id: string | null
  product_name: string
  variant_name: string | null
  sku: string | null
  thumbnail_url: string | null
  stock: number
  min_stock: number
  low_stock_threshold: number
  is_low_stock: boolean
  source_stock: number | null
}

interface CrossViewRow {
  product_id: string
  product_name: string
  sku: string | null
  branchStocks: Record<string, { stock: number; min_stock: number; low_stock_threshold: number }>
}

type ProductImageRef = {
  image_url: string
  is_primary: boolean
  display_order: number
}

const getPrimaryImageUrl = (images: ProductImageRef[] | null | undefined): string | null => {
  if (!images || images.length === 0) return null
  const primary = images.find((img) => img.is_primary)
  if (primary?.image_url) return primary.image_url
  const ordered = [...images].sort((a, b) => a.display_order - b.display_order)
  return ordered[0]?.image_url || null
}

const escapeCsv = (value: string | number): string => {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const toDateStamp = (date: Date): string => date.toISOString().split('T')[0].replace(/-/g, '')

export function AdminInventory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { organizationId, isAdmin } = useOrganization()
  const { show } = useToastStore()
  const { canUseFeature } = usePlanLimits()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [editingItem, setEditingItem] = useState<{ id: string; stock: number; min_stock: number; low_stock_threshold: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const [unsyncedCount, setUnsyncedCount] = useState<number | null>(null)
  const [missingProductsCount, setMissingProductsCount] = useState<number | null>(null)
  const [receiptModalItem, setReceiptModalItem] = useState<InventoryItem | null>(null)
  const [adjustmentModalItem, setAdjustmentModalItem] = useState<InventoryItem | null>(null)
  const [transferModalItem, setTransferModalItem] = useState<InventoryItem | null>(null)
  const [movementsModalItem, setMovementsModalItem] = useState<InventoryItem | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const [inventoryViewTab, setInventoryViewTab] = useState<'branch' | 'product'>('branch')
  const [crossViewData, setCrossViewData] = useState<CrossViewRow[]>([])
  const [crossViewLoading, setCrossViewLoading] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const fetchInventoryRequestId = useRef(0)

  useEffect(() => {
    const initialSearch = (searchParams.get('search') || '').trim()
    if (initialSearch) {
      setSearchInput(initialSearch)
      setDebouncedSearch(initialSearch)
      setPage(0)
      const next = new URLSearchParams(searchParams)
      next.delete('search')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(0)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (organizationId) {
      fetchBranches()
      checkMissingProducts()
    }
  }, [organizationId])

  useEffect(() => {
    if (selectedBranch && organizationId) {
      checkMissingProducts()
    }
  }, [selectedBranch, organizationId])

  useEffect(() => {
    if (organizationId) {
      checkUnsyncedItems()
    }
  }, [organizationId, selectedBranch])

  const fetchInventory = useCallback(async () => {
    if (!organizationId) return
    const requestId = ++fetchInventoryRequestId.current
    try {
      setLoading(true)
      const from = page * pageSize
      const to = from + pageSize - 1
      const hasSearch = debouncedSearch.length > 0

      const resolveSearchMatches = async (term: string) => {
        const likeTerm = `%${term}%`
        const [
          productsByNameResult,
          productsBySkuResult,
          variantsByNameResult,
          variantsBySkuResult,
        ] = await Promise.all([
          supabase
            .from('products')
            .select('id')
            .eq('organization_id', organizationId)
            .ilike('name', likeTerm),
          supabase
            .from('products')
            .select('id')
            .eq('organization_id', organizationId)
            .ilike('sku', likeTerm),
          supabase
            .from('product_variants')
            .select('id, product_id, products!inner(organization_id)')
            .eq('products.organization_id', organizationId)
            .ilike('name', likeTerm),
          supabase
            .from('product_variants')
            .select('id, product_id, products!inner(organization_id)')
            .eq('products.organization_id', organizationId)
            .ilike('sku', likeTerm),
        ])

        if (productsByNameResult.error) throw productsByNameResult.error
        if (productsBySkuResult.error) throw productsBySkuResult.error
        if (variantsByNameResult.error) throw variantsByNameResult.error
        if (variantsBySkuResult.error) throw variantsBySkuResult.error

        const productIds = new Set<string>()
        const variantIds = new Set<string>()

        for (const row of productsByNameResult.data || []) productIds.add(row.id)
        for (const row of productsBySkuResult.data || []) productIds.add(row.id)
        for (const row of variantsByNameResult.data || []) variantIds.add(row.id)
        for (const row of variantsBySkuResult.data || []) variantIds.add(row.id)

        if (productIds.size > 0) {
          const { data: variantsFromMatchedProducts, error: variantsFromMatchedProductsError } = await supabase
            .from('product_variants')
            .select('id')
            .in('product_id', Array.from(productIds))

          if (variantsFromMatchedProductsError) throw variantsFromMatchedProductsError
          for (const row of variantsFromMatchedProducts || []) variantIds.add(row.id)
        }

        return {
          productIds: Array.from(productIds),
          variantIds: Array.from(variantIds),
        }
      }

      let query = supabase
        .from('branch_inventory')
        .select(
          `
          id,
          branch_id,
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold,
          branches!inner(id, name, organization_id),
          products(
            id,
            organization_id,
            name,
            sku,
            stock,
            image_url,
            product_images (
              image_url,
              is_primary,
              display_order
            )
          ),
          product_variants(
            id,
            name,
            sku,
            image_url,
            product_id,
            stock,
            products!inner(
              id,
              organization_id,
              name,
              sku,
              stock,
              image_url,
              product_images (
                image_url,
                is_primary,
                display_order
              )
            )
          )
        `,
          { count: 'exact' }
        )
        .eq('branches.organization_id', organizationId)
        .order('stock', { ascending: sortDirection === 'asc' })

      if (selectedBranch) {
        query = query.eq('branch_id', selectedBranch)
      }

      if (hasSearch) {
        const { productIds, variantIds } = await resolveSearchMatches(debouncedSearch)
        if (productIds.length === 0 && variantIds.length === 0) {
          if (requestId !== fetchInventoryRequestId.current) return
          setInventory([])
          setTotalCount(0)
          return
        }
        if (productIds.length > 0 && variantIds.length > 0) {
          query = query.or(`product_id.in.(${productIds.join(',')}),variant_id.in.(${variantIds.join(',')})`)
        } else if (productIds.length > 0) {
          query = query.in('product_id', productIds)
        } else {
          query = query.in('variant_id', variantIds)
        }
      }

      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error
      if (requestId !== fetchInventoryRequestId.current) return
      const rawItems = (data || []).map((item: Record<string, unknown>) => {
        const branch = item.branches as { id: string; name: string } | null
        const product = item.product_id
          ? (item.products as Record<string, unknown> | null)
          : ((item.product_variants as { products?: Record<string, unknown> } | null)?.products ?? null)
        const variant = item.variant_id ? (item.product_variants as Record<string, unknown> | null) : null
        const productPrimaryImage = getPrimaryImageUrl(
          (product as { product_images?: ProductImageRef[] } | null)?.product_images
        )

        return {
          id: item.id as string,
          branch_id: item.branch_id as string,
          branch_name: branch?.name || 'N/A',
          product_id: item.product_id as string | null,
          variant_id: item.variant_id as string | null,
          product_name:
            (product as { name?: string } | null)?.name ||
            (variant as { name?: string } | null)?.name ||
            'N/A',
          variant_name: (variant as { name?: string } | null)?.name ?? null,
          sku:
            (variant as { sku?: string } | null)?.sku ??
            (product as { sku?: string } | null)?.sku ??
            null,
          thumbnail_url:
            (variant as { image_url?: string } | null)?.image_url ||
            productPrimaryImage ||
            (product as { image_url?: string } | null)?.image_url ||
            null,
          stock: item.stock as number,
          min_stock: item.min_stock as number,
          low_stock_threshold: item.low_stock_threshold as number,
          is_low_stock: (item.stock as number) <= (item.low_stock_threshold as number),
          source_stock:
            (variant as { stock?: number } | null)?.stock ??
            (product as { stock?: number } | null)?.stock ??
            null,
          source_org_id: (product as { organization_id?: string } | null)?.organization_id ?? null,
        }
      })

      const inventoryItems: InventoryItem[] = rawItems
        .filter((item) => {
          const scoped = item as InventoryItem & { source_org_id?: string | null }
          return !scoped.source_org_id || scoped.source_org_id === organizationId
        })
        .map((item) => {
          const sanitized = { ...(item as InventoryItem & { source_org_id?: string | null }) }
          delete (sanitized as { source_org_id?: string | null }).source_org_id
          return sanitized
        })

      setInventory(inventoryItems)
      setTotalCount(count ?? 0)
    } catch (err) {
      if (requestId !== fetchInventoryRequestId.current) return
      console.error('Error fetching inventory:', err)
      show('Error al cargar el inventario', 'error')
    } finally {
      if (requestId === fetchInventoryRequestId.current) {
        setLoading(false)
      }
    }
  }, [organizationId, page, pageSize, selectedBranch, debouncedSearch, sortDirection, show])

  useEffect(() => {
    if (organizationId) fetchInventory()
  }, [organizationId, fetchInventory])

  const fetchBranches = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      const branchesData = (data || []) as Branch[]
      setBranches(branchesData)
      if (branchesData.length > 0 && !selectedBranch) {
        setSelectedBranch(branchesData[0].id)
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem({
      id: item.id,
      stock: item.stock,
      min_stock: item.min_stock,
      low_stock_threshold: item.low_stock_threshold,
    })
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
  }

  const updateInventoryItemLocal = (
    itemId: string,
    updates: Partial<Pick<InventoryItem, 'stock' | 'min_stock' | 'low_stock_threshold'>>
  ) => {
    setInventory((prev) =>
      prev.map((inv) => {
        if (inv.id !== itemId) return inv
        const next = { ...inv, ...updates }
        return {
          ...next,
          is_low_stock: next.stock <= next.low_stock_threshold,
        }
      })
    )
  }

  const checkMissingProducts = async () => {
    try {
      const branchId = selectedBranch || branches[0]?.id
      if (!branchId || !organizationId) return

      // Count active products without inventory entries (org-scoped)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      if (productsError) throw productsError

      // Count active variants without inventory entries (via products of org)
      const ids = (productsData || []).map((p: { id: string }) => p.id)
      let variantsData: { id: string }[] = []
      if (ids.length > 0) {
        const { data: vData, error: vErr } = await supabase
          .from('product_variants')
          .select('id')
          .in('product_id', ids)
          .eq('is_active', true)
        if (vErr) throw vErr
        variantsData = vData || []
      }

      // Check which ones don't have inventory entries
      const prodIds = (productsData || []).map((p: { id: string }) => p.id)
      const variantIds = variantsData.map((v) => v.id)

      const { data: existingInventory } = await supabase
        .from('branch_inventory')
        .select('product_id, variant_id')
        .eq('branch_id', branchId)

      const existingProductIds = new Set(
        (existingInventory || [])
          .filter((inv): inv is { product_id: string; variant_id: string | null } => inv.product_id !== null)
          .map((inv) => inv.product_id)
      )
      const existingVariantIds = new Set(
        (existingInventory || [])
          .filter((inv): inv is { product_id: string | null; variant_id: string } => inv.variant_id !== null)
          .map((inv) => inv.variant_id)
      )

      const missingProducts = prodIds.filter((id: string) => !existingProductIds.has(id))
      const missingVariants = variantIds.filter((id: string) => !existingVariantIds.has(id))

      setMissingProductsCount(missingProducts.length + missingVariants.length)
    } catch (error) {
      console.error('Error checking missing products:', error)
    }
  }

  const getSourceStockFromSyncRow = (row: Record<string, unknown>): number | null => {
    const product = row.product_id
      ? (row.products as Record<string, unknown> | null)
      : ((row.product_variants as { products?: Record<string, unknown> } | null)?.products ?? null)
    const variant = row.variant_id ? (row.product_variants as Record<string, unknown> | null) : null
    const sourceStock =
      (variant as { stock?: number } | null)?.stock ??
      (product as { stock?: number } | null)?.stock ??
      null
    return typeof sourceStock === 'number' ? sourceStock : null
  }

  const fetchSyncScopeRows = async () => {
    if (!organizationId) return []

    let query = supabase
      .from('branch_inventory')
      .select(
        `
        id,
        branch_id,
        product_id,
        variant_id,
        stock,
        branches!inner(organization_id),
        products(
          id,
          organization_id,
          stock
        ),
        product_variants(
          id,
          stock,
          products!inner(
            id,
            organization_id
          )
        )
      `
      )
      .eq('branches.organization_id', organizationId)

    if (selectedBranch) {
      query = query.eq('branch_id', selectedBranch)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as Record<string, unknown>[]
  }

  const checkUnsyncedItems = async () => {
    if (!organizationId) return
    try {
      const rows = await fetchSyncScopeRows()
      const count = rows.reduce((acc, row) => {
        const sourceStock = getSourceStockFromSyncRow(row)
        const currentStock = Number(row.stock ?? 0)
        if (sourceStock !== null && sourceStock !== currentStock) return acc + 1
        return acc
      }, 0)
      setUnsyncedCount(count)
    } catch (error) {
      console.error('Error checking unsynced inventory items:', error)
      setUnsyncedCount(null)
    }
  }

  const fetchCrossView = async () => {
    if (!organizationId) return
    setCrossViewLoading(true)
    try {
      const { data, error } = await supabase
        .from('branch_inventory')
        .select(`
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold,
          branch:branches!inner(id, name, organization_id),
          product:products(id, name, sku)
        `)
        .eq('branches.organization_id', organizationId)
        .is('variant_id', null) // Only base products for clarity
        .not('product_id', 'is', null)

      if (error) throw error

      const rowMap = new Map<string, CrossViewRow>()
      for (const item of data || []) {
        const row = item as any
        const productId = row.product_id as string
        const branchId = row.branch?.id as string
        if (!productId || !branchId) continue
        if (!rowMap.has(productId)) {
          rowMap.set(productId, {
            product_id: productId,
            product_name: row.product?.name || 'Producto',
            sku: row.product?.sku || null,
            branchStocks: {},
          })
        }
        rowMap.get(productId)!.branchStocks[branchId] = {
          stock: row.stock ?? 0,
          min_stock: row.min_stock ?? 0,
          low_stock_threshold: row.low_stock_threshold ?? 0,
        }
      }

      setCrossViewData(Array.from(rowMap.values()).sort((a, b) => a.product_name.localeCompare(b.product_name)))
    } catch (err) {
      console.error('Error fetching cross-view inventory:', err)
    } finally {
      setCrossViewLoading(false)
    }
  }

  const handleSyncMissingProducts = async () => {
    if (!confirm('¿Crear entradas de inventario para todos los productos y variantes activos que no las tienen?')) {
      return
    }

    if (!organizationId) return
    try {
      setSyncing(true)
      // Type assertion needed because PostgREST types may not be updated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('populate_missing_inventory_entries_rpc', {
        p_organization_id: organizationId,
      })

      if (error) throw error

      const createdCount = data || 0
      await trackAuditAction({
        organizationId,
        tableName: 'branch_inventory',
        recordId: selectedBranch || 'all-branches',
        action: 'SYNC',
        notes: 'Sincronización de productos y variantes faltantes en inventario.',
        newData: { created_entries: createdCount, branch_id: selectedBranch || null },
      })
      show(`Se crearon ${createdCount} entradas de inventario faltantes`, 'success')
      setMissingProductsCount(0)
      fetchInventory()
    } catch (error: any) {
      console.error('Error syncing missing products:', error)
      show(error.message || 'Error al sincronizar productos faltantes', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleSave = async () => {
    if (!editingItem) return

    if (editingItem.stock < 0) {
      show('El stock no puede ser negativo', 'error')
      return
    }

    if (editingItem.min_stock < 0) {
      show('El stock mínimo no puede ser negativo', 'error')
      return
    }

    if (editingItem.low_stock_threshold < 0) {
      show('El umbral de stock bajo no puede ser negativo', 'error')
      return
    }

    try {
      setSaving(true)
      const currentItem = inventory.find((item) => item.id === editingItem.id)
      const previousStock = currentItem?.stock ?? editingItem.stock
      const quantityChange = editingItem.stock - previousStock

      const { error: updateError } = await supabase
        .from('branch_inventory')
        .update({
          stock: editingItem.stock,
          min_stock: editingItem.min_stock,
          low_stock_threshold: editingItem.low_stock_threshold,
        } as never)
        .eq('id', editingItem.id)

      if (updateError) throw updateError

      if (quantityChange !== 0) {
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            branch_inventory_id: editingItem.id,
            movement_type: 'adjustment',
            quantity: quantityChange,
            previous_stock: previousStock,
            new_stock: editingItem.stock,
            reference_type: 'manual',
            notes: 'Ajuste manual desde panel de inventario',
          })

        if (movementError) throw movementError
      }

      await trackAuditAction({
        organizationId,
        tableName: 'branch_inventory',
        recordId: editingItem.id,
        action: 'UPDATE',
        notes: 'Actualización manual de stock y umbrales desde panel de inventario.',
        oldData: {
          stock: previousStock,
          min_stock: currentItem?.min_stock ?? null,
          low_stock_threshold: currentItem?.low_stock_threshold ?? null,
        },
        newData: {
          stock: editingItem.stock,
          min_stock: editingItem.min_stock,
          low_stock_threshold: editingItem.low_stock_threshold,
          quantity_change: quantityChange,
        },
      })

      show('Inventario actualizado exitosamente', 'success')
      updateInventoryItemLocal(editingItem.id, {
        stock: editingItem.stock,
        min_stock: editingItem.min_stock,
        low_stock_threshold: editingItem.low_stock_threshold,
      })
      setEditingItem(null)
    } catch (error: any) {
      console.error('Error updating inventory:', error)
      show(error?.message || 'Error al actualizar el inventario', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncItemStock = async (item: InventoryItem) => {
    if (!organizationId) return
    try {
      setSyncingItemId(item.id)

      let sourceStock: number | null = null
      let sourceLabel = 'producto'

      if (item.variant_id) {
        const { data: variantData, error: variantError } = await supabase
          .from('product_variants')
          .select('id, stock, product_id, products!inner(organization_id)')
          .eq('id', item.variant_id)
          .eq('products.organization_id', organizationId)
          .maybeSingle()

        if (variantError) throw variantError
        sourceStock = (variantData as { stock?: number } | null)?.stock ?? null
        sourceLabel = 'variante'
      } else if (item.product_id) {
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, stock')
          .eq('id', item.product_id)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (productError) throw productError
        sourceStock = (productData as { stock?: number } | null)?.stock ?? null
      }

      if (sourceStock === null) {
        show('No se encontró stock de origen para sincronizar.', 'error')
        return
      }

      if (sourceStock === item.stock) {
        show('El inventario ya está sincronizado con el stock de origen.', 'info')
        return
      }

      const previousStock = item.stock
      const quantityChange = sourceStock - previousStock

      const { error: updateError } = await supabase
        .from('branch_inventory')
        .update({ stock: sourceStock } as never)
        .eq('id', item.id)

      if (updateError) throw updateError

      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          branch_inventory_id: item.id,
          movement_type: 'adjustment',
          quantity: quantityChange,
          previous_stock: previousStock,
          new_stock: sourceStock,
          reference_type: 'sync_stock',
          notes: `Sincronización manual desde stock de ${sourceLabel}`,
        })

      if (movementError) throw movementError

      await trackAuditAction({
        organizationId,
        tableName: 'branch_inventory',
        recordId: item.id,
        action: 'SYNC',
        notes: `Sincronización manual con stock de ${sourceLabel}.`,
        oldData: { stock: previousStock },
        newData: {
          stock: sourceStock,
          quantity_change: quantityChange,
          source: sourceLabel,
          product_id: item.product_id,
          variant_id: item.variant_id,
          branch_id: item.branch_id,
        },
      })

      show(`Stock sincronizado (${sourceLabel}): ${previousStock} → ${sourceStock}`, 'success')
      updateInventoryItemLocal(item.id, { stock: sourceStock })
      checkUnsyncedItems()
    } catch (error: any) {
      console.error('Error syncing item stock:', error)
      show(error?.message || 'Error al sincronizar stock', 'error')
    } finally {
      setSyncingItemId(null)
    }
  }

  const handleSyncAllUnsynced = async () => {
    if (!organizationId || !isAdmin) return
    if (!confirm('¿Sincronizar todos los stocks desincronizados de este alcance?')) return

    try {
      setSyncingAll(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('sync_inventory_from_master_stock', {
        p_organization_id: organizationId,
        p_branch_id: selectedBranch || null,
        p_only_desynced: true,
      })
      if (error) throw error

      const updatedCount = Number(data || 0)
      if (updatedCount === 0) {
        show('No hay items desincronizados para sincronizar.', 'info')
        setUnsyncedCount(0)
        return
      }

      await trackAuditAction({
        organizationId,
        tableName: 'branch_inventory',
        recordId: selectedBranch || 'all-branches',
        action: 'SYNC',
        notes: 'Sincronización masiva de stocks desincronizados.',
        newData: {
          synced_items: updatedCount,
          branch_id: selectedBranch || null,
          source: 'rpc_sync_inventory_from_master_stock',
        },
      })

      show(`Se sincronizaron ${updatedCount} item(s) desincronizados.`, 'success')
      fetchInventory()
      checkUnsyncedItems()
    } catch (error: any) {
      console.error('Error syncing all unsynced inventory items:', error)
      show(error?.message || 'Error al sincronizar todos los desincronizados', 'error')
    } finally {
      setSyncingAll(false)
    }
  }

  const mapInventoryRow = (item: Record<string, unknown>): InventoryItem & { source_org_id?: string | null } => {
    const branch = item.branches as { id: string; name: string } | null
    const product = item.product_id
      ? (item.products as Record<string, unknown> | null)
      : ((item.product_variants as { products?: Record<string, unknown> } | null)?.products ?? null)
    const variant = item.variant_id ? (item.product_variants as Record<string, unknown> | null) : null
    const productPrimaryImage = getPrimaryImageUrl(
      (product as { product_images?: ProductImageRef[] } | null)?.product_images
    )

    return {
      id: item.id as string,
      branch_id: item.branch_id as string,
      branch_name: branch?.name || 'N/A',
      product_id: item.product_id as string | null,
      variant_id: item.variant_id as string | null,
      product_name:
        (product as { name?: string } | null)?.name ||
        (variant as { name?: string } | null)?.name ||
        'N/A',
      variant_name: (variant as { name?: string } | null)?.name ?? null,
      sku:
        (variant as { sku?: string } | null)?.sku ??
        (product as { sku?: string } | null)?.sku ??
        null,
      thumbnail_url:
        (variant as { image_url?: string } | null)?.image_url ||
        productPrimaryImage ||
        (product as { image_url?: string } | null)?.image_url ||
        null,
      stock: item.stock as number,
      min_stock: item.min_stock as number,
      low_stock_threshold: item.low_stock_threshold as number,
      is_low_stock: (item.stock as number) <= (item.low_stock_threshold as number),
      source_stock:
        (variant as { stock?: number } | null)?.stock ??
        (product as { stock?: number } | null)?.stock ??
        null,
      source_org_id: (product as { organization_id?: string } | null)?.organization_id ?? null,
    }
  }

  const fetchAllInventoryForExport = async (): Promise<InventoryItem[]> => {
    if (!organizationId) return []

    const allRows: (InventoryItem & { source_org_id?: string | null })[] = []
    let from = 0

    while (true) {
      const to = from + EXPORT_BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('branch_inventory')
        .select(
          `
          id,
          branch_id,
          product_id,
          variant_id,
          stock,
          min_stock,
          low_stock_threshold,
          branches!inner(id, name, organization_id),
          products(
            id,
            organization_id,
            name,
            sku,
            stock,
            image_url,
            product_images (
              image_url,
              is_primary,
              display_order
            )
          ),
          product_variants(
            id,
            name,
            sku,
            image_url,
            product_id,
            stock,
            products!inner(
              id,
              organization_id,
              name,
              sku,
              stock,
              image_url,
              product_images (
                image_url,
                is_primary,
                display_order
              )
            )
          )
        `
        )
        .eq('branches.organization_id', organizationId)
        .order('id', { ascending: true })
        .range(from, to)

      if (error) throw error

      const batch = (data || []).map((row: Record<string, unknown>) => mapInventoryRow(row))
      allRows.push(...batch)

      if (batch.length < EXPORT_BATCH_SIZE) {
        break
      }
      from += EXPORT_BATCH_SIZE
    }

    return allRows
      .filter((item) => !item.source_org_id || item.source_org_id === organizationId)
      .map((item) => {
        const sanitized = { ...(item as InventoryItem & { source_org_id?: string | null }) }
        delete (sanitized as { source_org_id?: string | null }).source_org_id
        return sanitized
      })
  }

  const handleExportAllInventory = async () => {
    if (!organizationId) return

    try {
      setExportingAll(true)
      const allInventory = await fetchAllInventoryForExport()

      if (allInventory.length === 0) {
        show('No hay inventario para exportar.', 'info')
        return
      }

      const rows: Array<Array<string | number>> = [
        [
          'N°',
          'Sucursal',
          'Producto',
          'Variante',
          'SKU',
          'Stock',
          'Stock minimo',
          'Umbral stock bajo',
          'Estado stock',
        ],
      ]

      allInventory.forEach((item, index) => {
        rows.push([
          index + 1,
          item.branch_name,
          capitalizeFirst(item.product_name),
          item.variant_name ? capitalizeFirst(item.variant_name) : '',
          item.sku || '',
          item.stock,
          item.min_stock,
          item.low_stock_threshold,
          item.is_low_stock ? 'Bajo' : 'Normal',
        ])
      })

      const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventario_completo_${toDateStamp(new Date())}.csv`
      link.click()
      URL.revokeObjectURL(url)

      show(`Inventario exportado (${allInventory.length} filas).`, 'success')
    } catch (error: any) {
      console.error('Error exporting inventory:', error)
      show(error?.message || 'Error al exportar inventario.', 'error')
    } finally {
      setExportingAll(false)
    }
  }

  const lowStockCount = inventory.filter((item) => item.is_low_stock).length
  const fromItem = totalCount === 0 ? 0 : page * pageSize + 1
  const toItem = Math.min((page + 1) * pageSize, totalCount)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasPrev = page > 0
  const hasNext = page < totalPages - 1
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Inventario</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Administra el stock por sucursal</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportAllInventory}
            disabled={exportingAll}
            size="sm"
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportingAll ? 'Exportando...' : 'Exportar (Excel)'}
          </Button>
          {missingProductsCount !== null && missingProductsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-medium text-blue-900">{missingProductsCount} sin inventario</span>
              <Button variant="outline" size="sm" onClick={handleSyncMissingProducts} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sync...' : 'Sincronizar'}
              </Button>
            </div>
          )}
          {isAdmin && unsyncedCount !== null && unsyncedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-sm">
              <RefreshCw className="h-4 w-4 text-purple-600 shrink-0" />
              <span className="font-medium text-purple-900">{unsyncedCount} desincronizado{unsyncedCount !== 1 ? 's' : ''}</span>
              <Button variant="outline" size="sm" onClick={handleSyncAllUnsynced} disabled={syncingAll}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncingAll ? 'animate-spin' : ''}`} />
                {syncingAll ? 'Sync...' : 'Sincronizar'}
              </Button>
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
              <span className="font-medium text-yellow-900">{lowStockCount} stock bajo</span>
            </div>
          )}
        </div>
      </div>

      {/* View tab toggle */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setInventoryViewTab('branch')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${inventoryViewTab === 'branch' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
        >
          Por sucursal
        </button>
        <button
          type="button"
          onClick={() => {
            setInventoryViewTab('product')
            if (crossViewData.length === 0) fetchCrossView()
          }}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${inventoryViewTab === 'product' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}
        >
          Por producto (cruzado)
        </button>
      </div>

      {/* Cross-view table */}
      {inventoryViewTab === 'product' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock por producto en todas las sucursales
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchCrossView} disabled={crossViewLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${crossViewLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            {crossViewLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
              </div>
            ) : crossViewData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay datos de inventario disponibles</p>
              </div>
            ) : (
              <>
                {/* Mobile: cards por producto */}
                <div className="md:hidden divide-y">
                  {crossViewData.map((row) => (
                    <div key={row.product_id} className="p-4 space-y-2">
                      <div>
                        <p className="font-semibold text-gray-900">{capitalizeFirst(row.product_name)}</p>
                        {row.sku && <p className="text-xs text-gray-400 font-mono">{row.sku}</p>}
                      </div>
                      <div className="space-y-1.5">
                        {branches.map((b) => {
                          const cell = row.branchStocks[b.id]
                          const isOut = !cell || cell.stock === 0
                          const isLow = cell && !isOut && (cell.stock <= (cell.low_stock_threshold || 0) || cell.stock <= (cell.min_stock || 0))
                          return (
                            <div key={b.id} className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-600 truncate">{b.name}</span>
                              {cell ? (
                                <span className={`inline-block min-w-[2.5rem] text-center rounded-md px-2 py-0.5 text-sm font-semibold shrink-0 ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                                  {cell.stock}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs sticky left-0 bg-gray-50 z-10">Producto</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase text-xs">SKU</th>
                        {branches.map((b) => (
                          <th key={b.id} className="px-4 py-3 text-center font-medium text-gray-500 uppercase text-xs whitespace-nowrap">
                            {b.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {crossViewData.map((row) => (
                        <tr key={row.product_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white max-w-[200px] truncate">
                            {capitalizeFirst(row.product_name)}
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs font-mono">{row.sku || '—'}</td>
                          {branches.map((b) => {
                            const cell = row.branchStocks[b.id]
                            if (!cell) return (
                              <td key={b.id} className="px-4 py-3 text-center text-gray-300">—</td>
                            )
                            const isLow = cell.stock <= (cell.low_stock_threshold || 0) || cell.stock <= (cell.min_stock || 0)
                            const isOut = cell.stock === 0
                            return (
                              <td key={b.id} className="px-4 py-3 text-center">
                                <span className={`inline-block min-w-[2.5rem] rounded-md px-2 py-0.5 text-sm font-semibold ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                                  {cell.stock}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mobile search — only in branch view */}
      {inventoryViewTab === 'branch' && (
        <div className="md:hidden mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Filters — only shown in branch view */}
      {inventoryViewTab === 'branch' && <div className="hidden md:block"><Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Filtros</span>
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFiltersCollapsed((prev) => !prev)}
            >
              {filtersCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Mostrar
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ocultar
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {!filtersCollapsed && (
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-3">
                Filtros de listado
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sucursal</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => {
                      setSelectedBranch(e.target.value)
                      setPage(0)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Producto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Buscar por nombre..."
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mostrar</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(0)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} por página
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-3">
                Ordenamiento
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ordenar por</label>
                  <Input value="Stock" readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                  <select
                    value={sortDirection}
                    onChange={(e) => {
                      setSortDirection(e.target.value as 'asc' | 'desc')
                      setPage(0)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  >
                    <option value="asc">Ascendente (menor stock primero)</option>
                    <option value="desc">Descendente (mayor stock primero)</option>
                  </select>
                </div>
              </div>
            </div>

            {(selectedBranch || searchInput || sortDirection !== 'asc') && (
              <div className="pt-1">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBranch('')
                    setSearchInput('')
                    setSortDirection('asc')
                    setPage(0)
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card></div>}

      {/* Inventory Table — only in branch view */}
      {inventoryViewTab === 'branch' && <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Inventario ({totalCount} producto{totalCount !== 1 ? 's' : ''} en total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No se encontraron productos en el inventario</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {inventory.map((item) => {
                  const isLow = item.is_low_stock
                  const isOut = item.stock === 0
                  return (
                    <div key={item.id} className={`p-4 space-y-2 ${isLow ? 'bg-yellow-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt={item.product_name} className="h-10 w-10 rounded-md object-cover shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{capitalizeFirst(item.product_name)}</p>
                            {item.variant_name && <p className="text-xs text-gray-500">{capitalizeFirst(item.variant_name)}</p>}
                            <p className="text-xs text-gray-400 font-mono">{item.sku || 'N/A'}</p>
                          </div>
                        </div>
                        {editingItem?.id === item.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-700 p-1">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={saving} className="text-gray-600 p-1">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <ActionsMenu
                            actions={[
                              {
                                label: syncingItemId === item.id ? 'Sincronizando...' : item.source_stock === null ? 'Sin stock de origen' : `Sincronizar (${item.source_stock})`,
                                icon: <RefreshCw className={`h-4 w-4 ${syncingItemId === item.id ? 'animate-spin' : ''}`} />,
                                onClick: () => handleSyncItemStock(item),
                                disabled: syncingItemId !== null || item.source_stock === null,
                              },
                              { label: 'Editar Stock', icon: <Edit className="h-4 w-4" />, onClick: () => handleEdit(item) },
                              { label: 'Ingreso manual', icon: <Plus className="h-4 w-4" />, onClick: () => setReceiptModalItem(item) },
                              { label: 'Ajuste de Inventario', icon: <Edit className="h-4 w-4" />, onClick: () => setAdjustmentModalItem(item) },
                              ...(canUseFeature('transfers') ? [{ label: 'Transferir', icon: <ArrowRight className="h-4 w-4" />, onClick: () => setTransferModalItem(item) }] : []),
                              { label: 'Ver Historial', icon: <History className="h-4 w-4" />, onClick: () => setMovementsModalItem(item) },
                            ]}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="text-xs">{item.branch_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {editingItem?.id === item.id ? (
                            <div className="flex items-center gap-2">
                              <Input type="number" min="0" value={editingItem.stock} onChange={(e) => setEditingItem({ ...editingItem, stock: parseInt(e.target.value) || 0 })} className="w-20 text-center h-8" autoFocus />
                            </div>
                          ) : (
                            <span className={`text-lg font-bold ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-700'}`}>
                              {item.stock}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">en stock</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sucursal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Producto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Stock Mín.</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Umbral Bajo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventory.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 ${item.is_low_stock ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{item.branch_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-md border border-gray-200 bg-gray-100 overflow-hidden shrink-0">
                            {item.thumbnail_url ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: item.thumbnail_url as string,
                                    name: capitalizeFirst(item.product_name),
                                  })
                                }
                                className="h-full w-full block"
                              >
                                <img
                                  src={item.thumbnail_url}
                                  alt={capitalizeFirst(item.product_name)}
                                  className="h-full w-full object-cover hover:scale-105 transition-transform"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-gray-400">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{capitalizeFirst(item.product_name)}</p>
                            {item.variant_name && (
                              <p className="text-xs text-gray-500">Variante: {capitalizeFirst(item.variant_name)}</p>
                            )}
                            <p className="text-xs text-gray-500">SKU: {item.sku || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingItem?.id === item.id ? (
                          <Input
                            type="number"
                            min="0"
                            value={editingItem.stock}
                            onChange={(e) =>
                              setEditingItem({ ...editingItem, stock: parseInt(e.target.value) || 0 })
                            }
                            className="w-20 text-center"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`text-sm font-semibold ${
                              item.is_low_stock ? 'text-red-600' : 'text-gray-900'
                            }`}
                          >
                            {item.stock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingItem?.id === item.id ? (
                          <Input
                            type="number"
                            min="0"
                            value={editingItem.min_stock}
                            onChange={(e) =>
                              setEditingItem({ ...editingItem, min_stock: parseInt(e.target.value) || 0 })
                            }
                            className="w-20 text-center"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{item.min_stock}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingItem?.id === item.id ? (
                          <Input
                            type="number"
                            min="0"
                            value={editingItem.low_stock_threshold}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                low_stock_threshold: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-center"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{item.low_stock_threshold}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingItem?.id === item.id ? (
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSave}
                              disabled={saving}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <ActionsMenu
                            actions={[
                              {
                                label:
                                  syncingItemId === item.id
                                    ? 'Sincronizando stock...'
                                    : item.source_stock === null
                                      ? 'Sin stock de origen'
                                      : `Sincronizar stock (${item.source_stock})`,
                                icon: <RefreshCw className={`h-4 w-4 ${syncingItemId === item.id ? 'animate-spin' : ''}`} />,
                                onClick: () => handleSyncItemStock(item),
                                disabled: syncingItemId !== null || item.source_stock === null,
                              },
                              {
                                label: 'Editar Stock',
                                icon: <Edit className="h-4 w-4" />,
                                onClick: () => handleEdit(item),
                              },
                              {
                                label: 'Ingreso manual de stock',
                                icon: <Plus className="h-4 w-4" />,
                                onClick: () => setReceiptModalItem(item),
                              },
                              {
                                label: 'Ajuste de Inventario',
                                icon: <Edit className="h-4 w-4" />,
                                onClick: () => setAdjustmentModalItem(item),
                              },
                              ...(canUseFeature('transfers')
                                ? [
                                    {
                                      label: 'Transferir a otra Sucursal',
                                      icon: <ArrowRight className="h-4 w-4" />,
                                      onClick: () => setTransferModalItem(item),
                                    },
                                  ]
                                : []),
                              {
                                label: 'Ver Historial',
                                icon: <History className="h-4 w-4" />,
                                onClick: () => setMovementsModalItem(item),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          {/* Paginación */}
          {!loading && totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Mostrando {fromItem}-{toItem} de {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={!hasPrev}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={!hasNext}
                  className="gap-1"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Modals */}
      {receiptModalItem && (
        <InventoryReceiptModal
          inventoryItem={{
            id: receiptModalItem.id,
            branch_id: receiptModalItem.branch_id,
            branch_name: receiptModalItem.branch_name,
            product_id: receiptModalItem.product_id,
            variant_id: receiptModalItem.variant_id,
            product_name: receiptModalItem.product_name,
            variant_name: receiptModalItem.variant_name,
            current_stock: receiptModalItem.stock,
          }}
          onClose={() => setReceiptModalItem(null)}
          onSuccess={fetchInventory}
        />
      )}

      {adjustmentModalItem && (
        <InventoryAdjustmentModal
          inventoryItem={{
            id: adjustmentModalItem.id,
            branch_id: adjustmentModalItem.branch_id,
            branch_name: adjustmentModalItem.branch_name,
            product_id: adjustmentModalItem.product_id,
            variant_id: adjustmentModalItem.variant_id,
            product_name: adjustmentModalItem.product_name,
            variant_name: adjustmentModalItem.variant_name,
            current_stock: adjustmentModalItem.stock,
          }}
          onClose={() => setAdjustmentModalItem(null)}
          onSuccess={fetchInventory}
        />
      )}

      {transferModalItem && (
        <InventoryTransferModal
          inventoryItem={{
            id: transferModalItem.id,
            branch_id: transferModalItem.branch_id,
            branch_name: transferModalItem.branch_name,
            product_id: transferModalItem.product_id,
            variant_id: transferModalItem.variant_id,
            product_name: transferModalItem.product_name,
            variant_name: transferModalItem.variant_name,
            current_stock: transferModalItem.stock,
          }}
          branches={branches}
          onClose={() => setTransferModalItem(null)}
          onSuccess={fetchInventory}
        />
      )}

      {movementsModalItem && (
        <InventoryMovementsModal
          branchInventoryId={movementsModalItem.id}
          productName={movementsModalItem.product_name}
          variantName={movementsModalItem.variant_name}
          onClose={() => setMovementsModalItem(null)}
        />
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900 truncate">{previewImage.name}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-gray-50 max-h-[80vh] overflow-auto">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
