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
import { capitalizeFirst } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit,
  History,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

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

export function AdminInventory() {
  const { organizationId } = useOrganization()
  const { show } = useToastStore()
  const { canUseFeature } = usePlanLimits()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [editingItem, setEditingItem] = useState<{ id: string; stock: number; min_stock: number; low_stock_threshold: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [missingProductsCount, setMissingProductsCount] = useState<number | null>(null)
  const [receiptModalItem, setReceiptModalItem] = useState<InventoryItem | null>(null)
  const [adjustmentModalItem, setAdjustmentModalItem] = useState<InventoryItem | null>(null)
  const [transferModalItem, setTransferModalItem] = useState<InventoryItem | null>(null)
  const [movementsModalItem, setMovementsModalItem] = useState<InventoryItem | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

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
      fetchProducts()
      checkMissingProducts()
    }
  }, [organizationId])

  useEffect(() => {
    if (selectedBranch && organizationId) {
      checkMissingProducts()
    }
  }, [selectedBranch, organizationId])

  const fetchInventory = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)
      const from = page * pageSize
      const to = from + pageSize - 1

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
            name,
            sku,
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
            products!inner(
              id,
              name,
              sku,
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
        .order('stock', { ascending: true })
        .range(from, to)

      if (selectedBranch) {
        query = query.eq('branch_id', selectedBranch)
      }
      if (debouncedSearch) {
        const term = `%${debouncedSearch}%`
        query = query.or(`products.name.ilike.${term},product_variants.name.ilike.${term}`)
      }

      const { data, error, count } = await query

      if (error) throw error
      const inventoryItems: InventoryItem[] = (data || []).map((item: Record<string, unknown>) => {
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
        }
      })

      setInventory(inventoryItems)
      setTotalCount(count ?? 0)
    } catch (err) {
      console.error('Error fetching inventory:', err)
      show('Error al cargar el inventario', 'error')
    } finally {
      setLoading(false)
    }
  }, [organizationId, page, pageSize, selectedBranch, debouncedSearch, show])

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

  const fetchProducts = async () => {
    if (!organizationId) return
    try {
      const { error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
    } catch (error) {
      console.error('Error fetching products:', error)
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
      const { data: productsForVariants } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
      const ids = (productsForVariants || []).map((p: { id: string }) => p.id)
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
          .filter((inv: { product_id?: string }) => inv.product_id)
          .map((inv: { product_id: string }) => inv.product_id)
      )
      const existingVariantIds = new Set(
        (existingInventory || [])
          .filter((inv: { variant_id?: string }) => inv.variant_id)
          .map((inv: { variant_id: string }) => inv.variant_id)
      )

      const missingProducts = prodIds.filter((id: string) => !existingProductIds.has(id))
      const missingVariants = variantIds.filter((id: string) => !existingVariantIds.has(id))

      setMissingProductsCount(missingProducts.length + missingVariants.length)
    } catch (error) {
      console.error('Error checking missing products:', error)
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
      // Use adjust_inventory function to track the change
      // Type assertion needed because PostgREST types may not be updated after migration 028
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('adjust_inventory', {
        p_branch_inventory_id: editingItem.id,
        p_new_stock: editingItem.stock,
        p_notes: 'Ajuste manual desde panel de inventario',
      })

      if (error) throw error

      // Update min_stock and low_stock_threshold separately
      const { error: updateError } = await supabase
        .from('branch_inventory')
        .update({
          min_stock: editingItem.min_stock,
          low_stock_threshold: editingItem.low_stock_threshold,
        } as never)
        .eq('id', editingItem.id)

      if (updateError) throw updateError

      show('Inventario actualizado exitosamente', 'success')
      setEditingItem(null)
      fetchInventory()
    } catch (error) {
      console.error('Error updating inventory:', error)
      show('Error al actualizar el inventario', 'error')
    } finally {
      setSaving(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Inventario</h1>
          <p className="text-gray-600 mt-1">Administra el stock por sucursal</p>
        </div>
        <div className="flex items-center space-x-3">
          {missingProductsCount !== null && missingProductsCount > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {missingProductsCount} producto{missingProductsCount !== 1 ? 's' : ''} sin inventario
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncMissingProducts}
                disabled={syncing}
                className="ml-2"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">
                {lowStockCount} producto{lowStockCount !== 1 ? 's' : ''} con stock bajo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
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
            <div className="overflow-x-auto">
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
                                label: 'Editar Stock',
                                icon: <Edit className="h-4 w-4" />,
                                onClick: () => handleEdit(item),
                              },
                              {
                                label: 'Recepción de Mercadería',
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
      </Card>

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
