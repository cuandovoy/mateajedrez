import { BarcodeManager } from '@/components/admin/BarcodeManager'
import { ProductImportModal } from '@/components/admin/ProductImportModal'
import { ProductSupplierManager } from '@/components/admin/ProductSupplierManager'
import { ProductTable } from '@/components/admin/ProductTable'
import { VariantManager } from '@/components/admin/VariantManager'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { deleteImage, uploadProductImage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice, getEffectivePrice, formatDateShort } from '@/lib/utils'
import type { Branch, Category, Product, ProductImage, ProductInsert, ProductUpdate, ProductVariant, Supplier } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema } from '@/lib/schemas'
import type { ProductForm } from '@/lib/schemas'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Edit, Grid3x3, List, Package, Percent, Plus, ScanLine, Search, Star, Trash2, Truck, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { getMaxProductImages } from '@/lib/planLimits'
import { useOrganization } from '@/hooks/useOrganization'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { useToastStore } from '@/store/toastStore'
import { useNavigate } from 'react-router-dom'


interface ProductImageItem {
  id?: string
  image_url: string
  display_order: number
  is_primary: boolean
  file?: File
  preview?: string
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const


interface ProductWithImages extends Product {
  product_images?: ProductImage[]
  category?: Category | null
  inventory_stock?: number
  product_categories?: { category_id: string; category?: Category | null }[]
}

interface ProductVariantWithInventory extends ProductVariant {
  inventory_stock?: number
}

type ViewMode = 'grid' | 'list'
type StatusFilterValue = 'all' | 'active' | 'inactive'
type StockFilterValue = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type ProductSortBy = 'created_at' | 'name' | 'sku' | 'price' | 'stock'
type SortDirection = 'asc' | 'desc'

interface ProductFilters {
  search: string
  categoryId: string
  supplierId: string
  priceMin: string
  priceMax: string
  status: StatusFilterValue
  stock: StockFilterValue
  sortBy: ProductSortBy
  sortDirection: SortDirection
}

// ─── Discounts Tab Component ───────────────────────────────────────────────

interface DiscountFormState {
  productId: string
  percentage: string
  expiresAt: string
}

interface DiscountsTabProps {
  products: ProductWithImages[]
  allProducts: ProductWithImages[]
  loading: boolean
  settings: ReturnType<typeof import('@/hooks/useOrgSettings').useOrgSettings>
  onRefresh: () => void
}

function DiscountsTab({ products, allProducts, loading, settings, onRefresh }: DiscountsTabProps) {
  const { show } = useToastStore()
  const now = new Date()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [form, setForm] = useState<DiscountFormState>({ productId: '', percentage: '', expiresAt: '' })

  const active = products.filter((p) => !p.discount_expires_at || new Date(p.discount_expires_at) >= now)
  const expired = products.filter((p) => p.discount_expires_at && new Date(p.discount_expires_at) < now)

  const editingProduct = form.productId ? allProducts.find((p) => p.id === form.productId) ?? null : null

  const filteredAllProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    if (!q) return allProducts
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    )
  }, [allProducts, productSearch])

  const openNew = () => {
    setForm({ productId: '', percentage: '', expiresAt: '' })
    setProductSearch('')
    setModalOpen(true)
  }

  const openEdit = (p: ProductWithImages) => {
    setForm({
      productId: p.id,
      percentage: p.discount_percentage != null ? String(p.discount_percentage) : '',
      expiresAt: p.discount_expires_at ? p.discount_expires_at.slice(0, 16) : '',
    })
    setProductSearch('')
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setProductSearch('') }

  const handleSave = async () => {
    if (!form.productId) { show('Seleccioná un producto', 'error'); return }
    const pct = parseFloat(form.percentage)
    if (isNaN(pct) || pct <= 0 || pct > 100) { show('El descuento debe ser entre 1 y 100', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({
          discount_percentage: pct,
          discount_expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        })
        .eq('id', form.productId)
      if (error) throw error
      show('Descuento guardado', 'success')
      closeModal()
      onRefresh()
    } catch (err: any) {
      show(err?.message ?? 'Error al guardar el descuento', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!form.productId) return
    if (!confirm('¿Quitar el descuento de este producto?')) return
    setRemoving(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({ discount_percentage: null, discount_expires_at: null })
        .eq('id', form.productId)
      if (error) throw error
      show('Descuento eliminado', 'success')
      closeModal()
      onRefresh()
    } catch (err: any) {
      show(err?.message ?? 'Error al eliminar el descuento', 'error')
    } finally {
      setRemoving(false)
    }
  }

  const renderRows = (rows: ProductWithImages[], variant: 'active' | 'expired') =>
    rows.map((p) => {
      const effectivePrice = getEffectivePrice(p)
      const expiresAt = p.discount_expires_at ? new Date(p.discount_expires_at) : null
      const isExpired = expiresAt ? expiresAt < now : false
      return (
        <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isExpired ? 'opacity-70' : ''}`}>
          <td className="px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.name}</p>
              <p className="text-xs text-gray-400">{p.sku}</p>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-gray-700 text-right whitespace-nowrap">
            {formatPrice(p.price, settings)}
          </td>
          <td className="px-4 py-3 text-center">
            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
              variant === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
            }`}>
              -{p.discount_percentage}%
            </span>
          </td>
          <td className="px-4 py-3 text-sm font-semibold text-right whitespace-nowrap"
            style={{ color: variant === 'active' ? '#16a34a' : '#ea580c' }}>
            {formatPrice(effectivePrice, settings)}
          </td>
          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
            {expiresAt
              ? formatDateShort(p.discount_expires_at, settings)
              : <span className="text-gray-400 italic text-xs">Sin límite</span>}
          </td>
          <td className="px-4 py-3 text-center">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              variant === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${variant === 'active' ? 'bg-green-500' : 'bg-orange-500'}`} />
              {variant === 'active' ? 'Vigente' : 'Vencido'}
            </span>
          </td>
          <td className="px-4 py-3 text-center">
            <button
              onClick={() => openEdit(p)}
              className="p-1.5 text-gray-400 hover:text-admin-600 hover:bg-admin-50 rounded transition-colors"
              title="Editar descuento"
            >
              <Edit className="h-4 w-4" />
            </button>
          </td>
        </tr>
      )
    })

  const tableHead = (lastColLabel: string) => (
    <thead className="bg-gray-50 border-b border-gray-100">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio original</th>
        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Descuento</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio final</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{lastColLabel}</th>
        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Editar</th>
      </tr>
    </thead>
  )

  return (
    <>
      {/* Header row with button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {products.length === 0 ? 'Sin descuentos configurados' : `${active.length} vigente${active.length !== 1 ? 's' : ''}, ${expired.length} vencido${expired.length !== 1 ? 's' : ''}`}
        </p>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo descuento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <Percent className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No hay descuentos configurados</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Creá tu primer descuento con el botón de arriba.</p>
          <Button onClick={openNew} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo descuento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                Vigentes
                <span className="text-sm font-normal text-gray-500">({active.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {active.length === 0 ? (
                <p className="px-6 py-4 text-sm text-gray-400">No hay descuentos vigentes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {tableHead('Válido hasta')}
                    <tbody>{renderRows(active, 'active')}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {expired.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                  Vencidos
                  <span className="text-sm font-normal text-gray-500">({expired.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {tableHead('Venció el')}
                    <tbody>{renderRows(expired, 'expired')}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Discount Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-admin-600" />
                <h2 className="text-base font-semibold text-gray-900">
                  {editingProduct ? 'Editar descuento' : 'Nuevo descuento'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Product selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Producto</label>
                {editingProduct ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{editingProduct.name}</p>
                      <p className="text-xs text-gray-400">{editingProduct.sku} · {formatPrice(editingProduct.price, settings)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, productId: '' }))}
                      className="text-xs text-admin-600 hover:underline shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o SKU…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 mb-1.5"
                    />
                    <select
                      value={form.productId}
                      onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                      size={5}
                    >
                      <option value="">— Seleccioná un producto —</option>
                      {filteredAllProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) · {formatPrice(p.price, settings)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Percentage + expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Descuento (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      placeholder="ej: 20"
                      value={form.percentage}
                      onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))}
                      className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  {form.productId && form.percentage && editingProduct && !isNaN(parseFloat(form.percentage)) && (
                    <p className="mt-1 text-xs text-green-600 font-medium">
                      Precio final: {formatPrice(
                        Math.round(editingProduct.price * (1 - parseFloat(form.percentage) / 100) * 100) / 100,
                        settings
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Válido hasta
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">Opcional — vacío = sin límite</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              {editingProduct && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-sm text-red-500 hover:text-red-700 mr-auto disabled:opacity-50"
                >
                  {removing ? 'Quitando…' : 'Quitar descuento'}
                </button>
              )}
              <Button variant="outline" onClick={closeModal} className="ml-auto">
                Cancelar
              </Button>
              <Button onClick={handleSave} isLoading={saving} disabled={saving || removing}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

function AdminProductsContent() {
  const navigate = useNavigate()
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const { isAtLimit, productCount, limits, tier } = usePlanLimits()
  const maxProductImages = getMaxProductImages(tier)
  const [products, setProducts] = useState<ProductWithImages[]>([])
  const [productVariantsByProduct, setProductVariantsByProduct] = useState<Record<string, ProductVariantWithInventory[]>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'discounts'>('products')
  const [discountedProducts, setDiscountedProducts] = useState<ProductWithImages[]>([])
  const [loadingDiscounts, setLoadingDiscounts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithImages | null>(null)
  const [productImages, setProductImages] = useState<ProductImageItem[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [variantManagerProduct, setVariantManagerProduct] = useState<Product | null>(null)
  const [barcodeManagerProduct, setBarcodeManagerProduct] = useState<Product | null>(null)
  const [barcodeManagerVariant, setBarcodeManagerVariant] = useState<{ productId: string; variantId: string } | null>(null)
  const [supplierManagerProduct, setSupplierManagerProduct] = useState<Product | null>(null)
  const [initialBranchId, setInitialBranchId] = useState<string>('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'status' | 'category' | 'price' | null>(null)
  const [bulkStatusValue, setBulkStatusValue] = useState<'active' | 'inactive'>('active')
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [bulkPricePct, setBulkPricePct] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    categoryId: '',
    supplierId: '',
    priceMin: '',
    priceMax: '',
    status: 'all',
    stock: 'all',
    sortBy: 'created_at',
    sortDirection: 'desc',
  })
  const [appliedSearch, setAppliedSearch] = useState('')

  // Auto-apply search with debounce (400ms) when user types
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0)
      setAppliedSearch(filters.search.trim())
    }, 400)
    return () => clearTimeout(timer)
  }, [filters.search])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      stock: 0,
      category_id: undefined,
      sku: '',
      is_active: true,
      discount_percentage: null,
      discount_expires_at: null,
    },
  })

  const fetchProducts = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)

      // If filtering by supplier, we need to get product IDs first
      let supplierProductIds: string[] | null = null
      if (filters.supplierId) {
        const { data: productSuppliersData, error: supplierError } = await supabase
          .from('product_suppliers')
          .select('product_id')
          .eq('supplier_id', filters.supplierId)

        if (supplierError) throw supplierError
        supplierProductIds = productSuppliersData?.map((ps: { product_id: string }) => ps.product_id) || []

        // If no products found for this supplier, return empty array
        if (supplierProductIds.length === 0) {
          setProducts([])
          setProductVariantsByProduct({})
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from('products')
        .select(`
          *,
          product_images (
            id,
            image_url,
            display_order,
            is_primary
          ),
          category:categories (
            id,
            name
          ),
          product_categories (
            category_id,
            category:categories (
              id,
              name
            )
          )
        `)
        .eq('organization_id', organizationId)

      // Apply filters
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }

      if (filters.supplierId && supplierProductIds) {
        query = query.in('id', supplierProductIds)
      }

      if (filters.status !== 'all') {
        query = query.eq('is_active', filters.status === 'active')
      }

      if (filters.priceMin) {
        query = query.gte('price', parseFloat(filters.priceMin))
      }

      if (filters.priceMax) {
        query = query.lte('price', parseFloat(filters.priceMax))
      }

      if (appliedSearch) {
        const term = appliedSearch.replace(/[%]/g, '').replace(/,/g, ' ').trim()
        if (term) {
          query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,sku.ilike.%${term}%`)
        }
      }

      if (filters.stock !== 'all') {
        // Stock filtering is applied client-side using branch_inventory aggregated stock.
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      const productsData = (data || []) as unknown as ProductWithImages[]

      const loadedProductIds = productsData.map((p) => p.id)
      let inventoryStockByProduct = new Map<string, number>()
      let variantsByProduct: Record<string, ProductVariantWithInventory[]> = {}
      if (loadedProductIds.length > 0) {
        const [directStockRes, variantStockRes, variantsRes, variantInventoryRes] = await Promise.all([
          supabase
            .from('branch_inventory')
            .select('product_id, stock, branches!inner(organization_id)')
            .in('product_id', loadedProductIds)
            .eq('branches.organization_id', organizationId),
          supabase
            .from('branch_inventory')
            .select('stock, product_variants!inner(product_id), branches!inner(organization_id)')
            .not('variant_id', 'is', null)
            .eq('branches.organization_id', organizationId),
          supabase
            .from('product_variants')
            .select('id, product_id, name, sku, price, stock, is_active, low_stock_threshold, min_stock, image_url, attributes, unit, created_at, updated_at')
            .in('product_id', loadedProductIds)
            .order('name', { ascending: true }),
          supabase
            .from('branch_inventory')
            .select('variant_id, stock, branches!inner(organization_id)')
            .not('variant_id', 'is', null)
            .eq('branches.organization_id', organizationId),
        ])

        if (directStockRes.error) throw directStockRes.error
        if (variantStockRes.error) throw variantStockRes.error
        if (variantsRes.error) throw variantsRes.error
        if (variantInventoryRes.error) throw variantInventoryRes.error

        inventoryStockByProduct = new Map<string, number>()

        ;(directStockRes.data || []).forEach((row: any) => {
          const productId = row.product_id as string | null
          if (!productId) return
          const prev = inventoryStockByProduct.get(productId) || 0
          inventoryStockByProduct.set(productId, prev + (row.stock || 0))
        })

        ;(variantStockRes.data || []).forEach((row: any) => {
          const productId = row.product_variants?.product_id as string | null
          if (!productId) return
          if (!loadedProductIds.includes(productId)) return
          const prev = inventoryStockByProduct.get(productId) || 0
          inventoryStockByProduct.set(productId, prev + (row.stock || 0))
        })

        const inventoryStockByVariant = new Map<string, number>()
        ;(variantInventoryRes.data || []).forEach((row: any) => {
          const variantId = row.variant_id as string | null
          if (!variantId) return
          const prev = inventoryStockByVariant.get(variantId) || 0
          inventoryStockByVariant.set(variantId, prev + (row.stock || 0))
        })

        ;(variantsRes.data || []).forEach((variant) => {
          const variantWithInventory: ProductVariantWithInventory = {
            ...(variant as ProductVariantWithInventory),
            inventory_stock: inventoryStockByVariant.get(variant.id) ?? (variant.stock || 0),
          }
          if (!variantsByProduct[variant.product_id]) {
            variantsByProduct[variant.product_id] = []
          }
          variantsByProduct[variant.product_id].push(variantWithInventory)
        })
      }

      setProducts(
        productsData.map((product) => ({
          ...product,
          // Fallback to legacy/master stock when there is no branch_inventory row yet.
          inventory_stock: inventoryStockByProduct.get(product.id) ?? (product.stock || 0),
        }))
      )
      setProductVariantsByProduct(variantsByProduct)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }, [organizationId, filters.categoryId, filters.supplierId, filters.status, filters.priceMin, filters.priceMax, filters.stock, appliedSearch])

  useEffect(() => {
    if (organizationId) {
      fetchCategories()
      fetchSuppliers()
      fetchBranches()
    }
  }, [organizationId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Filter products client-side only for stock and ordering.
  const filteredProducts = useMemo(() => {
    let filtered = products

    if (filters.stock !== 'all') {
      filtered = filtered.filter((product) => {
        const stock = product.inventory_stock ?? 0
        if (filters.stock === 'out_of_stock') return stock === 0
        if (filters.stock === 'in_stock') return stock > 0
        if (filters.stock === 'low_stock') return stock > 0 && stock <= (product.low_stock_threshold || 10)
        return true
      })
    }

    const directionMultiplier = filters.sortDirection === 'asc' ? 1 : -1
    const sorted = [...filtered].sort((a, b) => {
      if (filters.sortBy === 'name') {
        return a.name.localeCompare(b.name, 'es') * directionMultiplier
      }
      if (filters.sortBy === 'sku') {
        return a.sku.localeCompare(b.sku, 'es') * directionMultiplier
      }
      if (filters.sortBy === 'price') {
        return (Number(a.price || 0) - Number(b.price || 0)) * directionMultiplier
      }
      if (filters.sortBy === 'stock') {
        return (Number(a.inventory_stock || 0) - Number(b.inventory_stock || 0)) * directionMultiplier
      }
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return (aTime - bTime) * directionMultiplier
    })

    return sorted
  }, [products, filters.stock, filters.sortBy, filters.sortDirection])

  useEffect(() => {
    setPage(0)
  }, [
    viewMode,
    appliedSearch,
    filters.categoryId,
    filters.supplierId,
    filters.priceMin,
    filters.priceMax,
    filters.status,
    filters.stock,
    filters.sortBy,
    filters.sortDirection,
  ])

  const totalFiltered = filteredProducts.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const fromItem = totalFiltered === 0 ? 0 : safePage * pageSize + 1
  const toItem = Math.min((safePage + 1) * pageSize, totalFiltered)
  const hasPrev = safePage > 0
  const hasNext = safePage < totalPages - 1

  const paginatedProducts = useMemo(() => {
    const start = safePage * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, safePage, pageSize])

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage)
    }
  }, [page, safePage])

  const fetchCategories = useCallback(async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [organizationId])

  const fetchSuppliers = useCallback(async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }, [organizationId])

  const fetchBranches = useCallback(async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBranches((data || []) as Branch[])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }, [organizationId])

  const fetchDiscountedProducts = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoadingDiscounts(true)
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (id, image_url, display_order, is_primary),
          category:categories (id, name)
        `)
        .eq('organization_id', organizationId)
        .not('discount_percentage', 'is', null)
        .order('discount_expires_at', { ascending: true, nullsFirst: false })
      if (error) throw error
      setDiscountedProducts((data || []) as unknown as ProductWithImages[])
    } catch (err) {
      console.error('Error fetching discounted products:', err)
    } finally {
      setLoadingDiscounts(false)
    }
  }, [organizationId])

  useEffect(() => {
    if (organizationId) fetchDiscountedProducts()
  }, [fetchDiscountedProducts])

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const slotsLeft = maxProductImages - productImages.length
    if (slotsLeft <= 0) {
      show(`Tu plan permite hasta ${maxProductImages} imagen${maxProductImages !== 1 ? 'es' : ''} por producto.`, 'error')
      e.target.value = ''
      return
    }

    const filesToAdd = files.slice(0, slotsLeft)
    if (files.length > slotsLeft) {
      show(`Solo se agregarán ${slotsLeft} imagen${slotsLeft !== 1 ? 'es' : ''} (máx. ${maxProductImages} por producto).`, 'info')
    }

    filesToAdd.forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert(`Tipo de archivo no permitido para ${file.name}. Use JPG, PNG o WEBP`)
        return
      }

      if (file.size > MAX_IMAGE_SIZE) {
        alert(`La imagen ${file.name} es demasiado grande. Máximo 5MB`)
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setProductImages((prev) => {
          if (prev.length >= maxProductImages) return prev
          const newImage: ProductImageItem = {
            image_url: '',
            display_order: prev.length,
            is_primary: prev.length === 0,
            file,
            preview: reader.result as string,
          }
          return [...prev, newImage]
        })
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ''
  }

  const handleImageUrlAdd = (url: string) => {
    if (!url.trim()) return
    if (productImages.length >= maxProductImages) {
      show(`Tu plan permite hasta ${maxProductImages} imagen${maxProductImages !== 1 ? 'es' : ''} por producto.`, 'error')
      return
    }
    const newImage: ProductImageItem = {
      image_url: url.trim(),
      display_order: productImages.length,
      is_primary: productImages.length === 0,
    }
    setProductImages([...productImages, newImage])
  }

  const removeImage = (index: number) => {
    const image = productImages[index]
    const newImages = productImages.filter((_, i) => i !== index)

    // If we removed the primary image, make the first one primary
    if (image.is_primary && newImages.length > 0) {
      newImages[0].is_primary = true
    }

    // Reorder display_order
    newImages.forEach((img, i) => {
      img.display_order = i
    })

    setProductImages(newImages)
  }

  const setPrimaryImage = (index: number) => {
    const newImages = productImages.map((img, i) => ({
      ...img,
      is_primary: i === index,
    }))
    setProductImages(newImages)
  }

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === productImages.length - 1)
    ) {
      return
    }

    const newImages = [...productImages]
    const newIndex = direction === 'up' ? index - 1 : index + 1
      ;[newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]]

    // Update display_order
    newImages.forEach((img, i) => {
      img.display_order = i
    })

    setProductImages(newImages)
  }

  const onSubmit = async (data: ProductForm) => {
    if (!organizationId) return

    if (!editingProduct && isAtLimit('products')) {
      show('Límite alcanzado (200 productos). Actualizá tu plan.', 'error')
      return
    }

    if (selectedCategoryIds.length === 0) {
      show('Seleccioná al menos una categoría.', 'error')
      return
    }

    // When creating with stock > 0, branch is required for inventory
    if (!editingProduct && data.stock > 0) {
      if (branches.length === 0) {
        alert('No hay sucursales disponibles. Crea una sucursal primero o deja el stock en 0.')
        return
      }
      if (!initialBranchId) {
        alert('Si indicas stock inicial, debes seleccionar la sucursal donde se cargará el inventario.')
        return
      }
    }

    if (productImages.length > maxProductImages) {
      show(
        `Tu plan permite hasta ${maxProductImages} imagen${maxProductImages !== 1 ? 'es' : ''} por producto. Eliminá las que sobran para guardar.`,
        'error'
      )
      return
    }

    try {
      setUploadingImage(true)

      const { stock, category_id: _cid, discount_expires_at, ...restData } = data
      const baseProductData = {
        ...restData,
        category_id: selectedCategoryIds[0] || undefined,
        image_url: null as null,
        discount_percentage: restData.discount_percentage ?? null,
        discount_expires_at: discount_expires_at ? new Date(discount_expires_at).toISOString() : null,
      }

      let productId: string

      if (editingProduct) {
        const productData: ProductUpdate = baseProductData
        const { data: updatedProduct, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
          .select()
          .single()

        if (error) throw error
        if (!updatedProduct) throw new Error('Producto no encontrado luego de actualizar')
        productId = updatedProduct.id
      } else {
        const productData: ProductInsert = {
          ...baseProductData,
          category_id: selectedCategoryIds[0] ?? '',
          stock,
          organization_id: organizationId!,
        }
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single()

        if (error) throw error
        if (!newProduct) throw new Error('No se pudo obtener el producto creado')
        productId = newProduct.id

        // Load initial stock into branch_inventory when creating with stock + branch
        if (stock > 0 && initialBranchId) {
          const { data: branchInventory, error: biError } = await supabase
            .from('branch_inventory')
            .select('id, stock')
            .eq('branch_id', initialBranchId)
            .eq('product_id', productId)
            .is('variant_id', null)
            .single()

          const bi = branchInventory as { id: string; stock: number } | null
          if (!biError && bi?.id) {
            const previousStock = bi.stock ?? 0
            const newStock = previousStock + stock

            const { error: updateError } = await supabase
              .from('branch_inventory')
              .update({ stock: newStock })
              .eq('id', bi.id)

            if (!updateError) {
              await supabase
                .from('inventory_movements')
                .insert({
                  branch_inventory_id: bi.id,
                  movement_type: 'receipt',
                  quantity: stock,
                  previous_stock: previousStock,
                  new_stock: newStock,
                  reference_type: 'receipt',
                  notes: 'Stock inicial al crear producto',
                })
            } else {
              console.error('Error loading initial inventory:', updateError)
              alert('Producto creado pero no se pudo cargar el stock inicial. Ajusta el inventario manualmente.')
            }
          }
        }
      }

      // Save multi-category associations (table not yet in generated types, cast needed)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      await sb.from('product_categories').delete().eq('product_id', productId)
      if (selectedCategoryIds.length > 0) {
        await sb.from('product_categories').insert(
          selectedCategoryIds.map((catId) => ({
            product_id: productId,
            category_id: catId,
            organization_id: organizationId!,
          }))
        )
      }

      // Handle product images
      if (productImages.length > 0) {
        // Upload new files first
        const imagesToSave: Array<{
          id?: string
          image_url: string
          display_order: number
          is_primary: boolean
        }> = []

        for (const image of productImages) {
          let imageUrl = image.image_url

          // Upload file if it exists (new image)
          if (image.file) {
            imageUrl = await uploadProductImage(image.file, productId, organizationId ?? undefined)
          }

          imagesToSave.push({
            id: image.id, // Keep existing ID if it exists
            image_url: imageUrl,
            display_order: image.display_order,
            is_primary: image.is_primary,
          })
        }

        if (editingProduct?.product_images && editingProduct.product_images.length > 0) {
          // Find images that were removed (exist in DB but not in productImages)
          const currentImageIds = new Set(
            productImages.filter((img) => img.id).map((img) => img.id!)
          )

          const imagesToDelete = editingProduct.product_images.filter(
            (img) => !currentImageIds.has(img.id)
          )

          // Delete removed images from database
          if (imagesToDelete.length > 0) {
            const idsToDelete = imagesToDelete.map((img) => img.id)
            const { error: deleteError } = await supabase
              .from('product_images')
              .delete()
              .in('id', idsToDelete)

            if (deleteError) {
              console.error('Error deleting removed images:', deleteError)
            }

            // Delete removed image files from storage
            for (const deletedImage of imagesToDelete) {
              try {
                // Only delete if the image URL was replaced (not just reordered)
                const stillExists = imagesToSave.some(
                  (img) => img.image_url === deletedImage.image_url
                )
                if (!stillExists) {
                  await deleteImage(deletedImage.image_url, 'product-images')
                }
              } catch (error) {
                console.error('Error deleting image file:', error)
              }
            }
          }

          // Update existing images that changed (order, primary status, or were replaced)
          const imagesToUpdate = imagesToSave.filter((img) => {
            if (!img.id) return false // New images don't have ID

            const existingImage = editingProduct.product_images?.find(
              (ei) => ei.id === img.id
            )
            if (!existingImage) return false

            // Check if anything changed
            return (
              existingImage.display_order !== img.display_order ||
              existingImage.is_primary !== img.is_primary ||
              existingImage.image_url !== img.image_url
            )
          })

          for (const imageToUpdate of imagesToUpdate) {
            if (!imageToUpdate.id) continue // Skip if no ID

            const { error: updateError } = await supabase
              .from('product_images')
              .update({
                image_url: imageToUpdate.image_url,
                display_order: imageToUpdate.display_order,
                is_primary: imageToUpdate.is_primary,
              })
              .eq('id', imageToUpdate.id)

            if (updateError) {
              console.error('Error updating image:', updateError)
            }

            // If image URL changed, delete old file from storage
            const oldImage = editingProduct.product_images?.find(
              (img) => img.id === imageToUpdate.id
            )
            if (oldImage && oldImage.image_url !== imageToUpdate.image_url) {
              try {
                await deleteImage(oldImage.image_url, 'product-images')
              } catch (error) {
                console.error('Error deleting old image file:', error)
              }
            }
          }

          // Insert only new images (without ID)
          const newImages = imagesToSave.filter((img) => !img.id)
          if (newImages.length > 0) {
            const { error: imagesError } = await supabase
              .from('product_images')
              .insert(
                newImages.map((img) => ({
                  product_id: productId,
                  image_url: img.image_url,
                  display_order: img.display_order,
                  is_primary: img.is_primary,
                }))
              )

            if (imagesError) throw imagesError
          }
        } else {
          // New product - insert all images
          const { error: imagesError } = await supabase
            .from('product_images')
            .insert(
              imagesToSave.map((img) => ({
                product_id: productId,
                image_url: img.image_url,
                display_order: img.display_order,
                is_primary: img.is_primary,
              }))
            )

          if (imagesError) throw imagesError
        }
      } else if (editingProduct?.product_images && editingProduct.product_images.length > 0) {
        // Delete all images if none are provided
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .eq('product_id', productId)

        if (deleteError) {
          console.error('Error deleting images:', deleteError)
        }

        // Delete image files from storage
        for (const oldImage of editingProduct.product_images) {
          try {
            await deleteImage(oldImage.image_url, 'product-images')
          } catch (error) {
            console.error('Error deleting image file:', error)
          }
        }
      }

      setIsModalOpen(false)
      setEditingProduct(null)
      setProductImages([])
      setSelectedCategoryIds([])
      setInitialBranchId('')
      reset()
      await fetchProducts()
      fetchDiscountedProducts()
    } catch (error: any) {
      console.error('Error saving product:', error)
      show(error?.message || 'Error al guardar el producto', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = (allSelected: boolean) => {
    if (allSelected) {
      setSelectedProductIds(new Set(paginatedProducts.map((p) => p.id)))
    } else {
      setSelectedProductIds(new Set())
    }
  }

  const applyBulkAction = async () => {
    if (!organizationId || selectedProductIds.size === 0 || !bulkAction) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedProductIds)
      if (bulkAction === 'status') {
        const { error } = await supabase
          .from('products')
          .update({ is_active: bulkStatusValue === 'active' })
          .in('id', ids)
          .eq('organization_id', organizationId)
        if (error) throw error
        show(`${ids.length} productos actualizados`, 'success')
      } else if (bulkAction === 'category' && bulkCategoryId) {
        const { error } = await supabase
          .from('products')
          .update({ category_id: bulkCategoryId })
          .in('id', ids)
          .eq('organization_id', organizationId)
        if (error) throw error
        show(`${ids.length} productos actualizados`, 'success')
      } else if (bulkAction === 'price' && bulkPricePct) {
        const pct = parseFloat(bulkPricePct)
        if (isNaN(pct)) return
        const factor = 1 + pct / 100
        for (const id of ids) {
          const product = products.find((p) => p.id === id)
          if (!product) continue
          const newPrice = Math.round(product.price * factor * 100) / 100
          await supabase.from('products').update({ price: newPrice }).eq('id', id)
        }
        show(`Precio ajustado en ${pct > 0 ? '+' : ''}${pct}% para ${ids.length} productos`, 'success')
      }
      setSelectedProductIds(new Set())
      setBulkAction(null)
      setBulkPricePct('')
      fetchProducts()
    } catch (err: any) {
      show(err?.message || 'Error al aplicar la acción masiva', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleEdit = (product: ProductWithImages) => {
    setEditingProduct(product)

    const existingImages: ProductImageItem[] = (product.product_images || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((img) => ({
        id: img.id,
        image_url: img.image_url,
        display_order: img.display_order,
        is_primary: img.is_primary ?? false,
      }))

    setProductImages(existingImages)

    const existingCatIds = (product.product_categories || []).map((pc) => pc.category_id)
    setSelectedCategoryIds(existingCatIds.length > 0 ? existingCatIds : product.category_id ? [product.category_id] : [])

    reset({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.inventory_stock ?? 0,
      category_id: product.category_id,
      sku: product.sku,
      is_active: product.is_active ?? true,
      discount_percentage: product.discount_percentage ?? null,
      discount_expires_at: product.discount_expires_at
        ? product.discount_expires_at.slice(0, 16)
        : null,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error al eliminar el producto')
    }
  }

  const handleNew = () => {
    if (isAtLimit('products')) {
      show('Límite alcanzado (200 productos). Actualizá tu plan.', 'error')
      return
    }
    setEditingProduct(null)
    setProductImages([])
    setInitialBranchId('')
    setSelectedCategoryIds([])
    reset()
    setIsModalOpen(true)
  }

  const goToInventoryAdjustment = (product: ProductWithImages | Product) => {
    const query = encodeURIComponent((product.sku || product.name || '').trim())
    navigate(`/inventory?search=${query}`)
  }

  const getPrimaryImage = (product: ProductWithImages): string | null => {
    if (product.product_images && product.product_images.length > 0) {
      const primary = product.product_images.find((img) => img.is_primary)
      if (primary) return primary.image_url
      // If no primary, return first image
      return product.product_images.sort((a, b) => a.display_order - b.display_order)[0].image_url
    }
    return product.image_url || null
  }

  const clearFilters = () => {
    setPage(0)
    setAppliedSearch('')
    setFilters({
      search: '',
      categoryId: '',
      supplierId: '',
      priceMin: '',
      priceMax: '',
      status: 'all',
      stock: 'all',
      sortBy: 'created_at',
      sortDirection: 'desc',
    })
  }

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      appliedSearch !== '' ||
      filters.categoryId !== '' ||
      filters.supplierId !== '' ||
      filters.priceMin !== '' ||
      filters.priceMax !== '' ||
      filters.status !== 'all' ||
      filters.stock !== 'all' ||
      filters.sortBy !== 'created_at' ||
      filters.sortDirection !== 'desc'
    )
  }, [filters, appliedSearch])

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const exportProductsPdf = async () => {
    const rowsToExport = filteredProducts
    if (rowsToExport.length === 0) {
      show('No hay productos para exportar.', 'info')
      return
    }

    try {
      setExportingPdf(true)

      const printWindow = window.open('', '_blank', 'width=1200,height=900')
      if (!printWindow) {
        show('No se pudo abrir la ventana de impresión. Habilita popups e inténtalo de nuevo.', 'error')
        return
      }

      const generatedAt = new Date().toLocaleString('es-UY')
      const filtersSummary = hasActiveFilters ? 'Sí' : 'No'
      const htmlRows = rowsToExport
        .map((product) => {
          const category = product.category?.name || 'Sin categoría'
          const stock = product.inventory_stock ?? 0
          const status = product.is_active ? 'Activo' : 'Inactivo'
          return `
            <tr>
              <td>${escapeHtml(product.name)}</td>
              <td>${escapeHtml(product.sku || '-')}</td>
              <td>${escapeHtml(category)}</td>
              <td class="number">${escapeHtml(formatPrice(product.price, settings))}</td>
              <td class="number">${stock}</td>
              <td>${status}</td>
            </tr>
          `
        })
        .join('')

      const html = `
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <title>Listado de Productos</title>
            <style>
              @page { size: A4 landscape; margin: 12mm; }
              body { font-family: Arial, sans-serif; color: #111827; }
              h1 { margin: 0 0 6px; font-size: 22px; }
              .meta { margin: 0 0 14px; font-size: 12px; color: #4b5563; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
              th { background: #f3f4f6; text-align: left; }
              .number { text-align: right; white-space: nowrap; }
            </style>
          </head>
          <body>
            <h1>Listado de Productos</h1>
            <p class="meta">Generado: ${escapeHtml(generatedAt)} | Productos: ${rowsToExport.length} | Filtros aplicados: ${filtersSummary}</p>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows}
              </tbody>
            </table>
          </body>
        </html>
      `

      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch (error) {
      console.error('Error exporting products PDF:', error)
      show('No se pudo exportar el PDF.', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="mb-8 flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <SkeletonTable rows={6} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Gestiona todos los productos de tu tienda
            {tier === 'starter' && limits.products != null && (
              <span className="ml-2 text-sm text-gray-500">
                ({productCount} / {limits.products})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-admin-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="Vista de lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-admin-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="Vista de grilla"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            onClick={exportProductsPdf}
            disabled={exportingPdf || filteredProducts.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {exportingPdf ? 'Exportando...' : 'PDF'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            disabled={isAtLimit('products')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={handleNew} disabled={isAtLimit('products')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-admin-600 text-admin-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'discounts'
              ? 'border-admin-600 text-admin-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Descuentos
          {discountedProducts.length > 0 && (
            <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
              {discountedProducts.length}
            </span>
          )}
        </button>
      </div>

      {/* ── DISCOUNTS TAB ── */}
      {activeTab === 'discounts' && (
        <DiscountsTab
          products={discountedProducts}
          allProducts={products}
          loading={loadingDiscounts}
          settings={settings}
          onRefresh={fetchDiscountedProducts}
        />
      )}

      {activeTab === 'products' && (
      <>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${filters.categoryId ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="">Categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.supplierId}
          onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${filters.supplierId ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="">Proveedor</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as StatusFilterValue })}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${filters.status !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="all">Estado: todos</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <select
          value={filters.stock}
          onChange={(e) => setFilters({ ...filters, stock: e.target.value as StockFilterValue })}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${filters.stock !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="all">Stock: todos</option>
          <option value="in_stock">Con stock</option>
          <option value="low_stock">Stock bajo</option>
          <option value="out_of_stock">Sin stock</option>
        </select>
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as ProductSortBy })}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${filters.sortBy !== 'created_at' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="created_at">Más recientes</option>
          <option value="name">Nombre</option>
          <option value="sku">SKU</option>
          <option value="price">Precio</option>
          <option value="stock">Stock</option>
        </select>
        <button
          onClick={() => setFilters({ ...filters, sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc' })}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          title={filters.sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
        >
          <ArrowDown className={`h-3.5 w-3.5 transition-transform ${filters.sortDirection === 'asc' ? 'rotate-180' : ''}`} />
        </button>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-admin-500"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}/pág.</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500 whitespace-nowrap">
          {fromItem}-{toItem} de {totalFiltered}
          {totalFiltered !== products.length && ` (de ${products.length})`}
        </span>
      </div>

      {/* Products Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProducts.map((product) => {
            const primaryImage = getPrimaryImage(product)
            return (
              <Card key={product.id} className="relative">
                <CardContent className="p-6">
                  {/* Actions Menu */}
                  <div className="absolute top-4 right-4">
                    <ActionsMenu
                      actions={[
                        {
                          label: 'Gestionar variantes',
                          icon: <Package className="h-4 w-4" />,
                          onClick: () => setVariantManagerProduct(product),
                        },
                        {
                          label: 'Código de barras',
                          icon: <ScanLine className="h-4 w-4" />,
                          onClick: () => setBarcodeManagerProduct(product),
                        },
                        {
                          label: 'Proveedores',
                          icon: <Truck className="h-4 w-4" />,
                          onClick: () => setSupplierManagerProduct(product),
                        },
                        {
                          label: 'Ajustar inventario',
                          icon: <Package className="h-4 w-4" />,
                          onClick: () => goToInventoryAdjustment(product),
                        },
                        {
                          label: 'Editar',
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => handleEdit(product),
                        },
                        {
                          label: 'Eliminar',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleDelete(product.id),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </div>
                  {primaryImage && (
                    <img
                      src={primaryImage}
                      alt={capitalizeFirst(product.name)}
                      className="w-full h-48 object-cover rounded mb-4"
                    />
                  )}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-8">
                    <span className="line-clamp-1">
                      {capitalizeFirst(product.name)}
                    </span>
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {capitalizeFirst(product.description) || 'Sin descripción'}
                  </p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-bold text-admin-600">
                      {formatPrice(product.price, settings)}
                    </span>
                    <span className={`text-sm ${(product.inventory_stock ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Stock: {product.inventory_stock ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>SKU: {product.sku}</span>
                    {product.category && (
                      <>
                        <span>•</span>
                        <span>{product.category.name}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ProductTable
              products={paginatedProducts}
              variantsByProduct={productVariantsByProduct}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManageVariants={setVariantManagerProduct}
              onManageBarcodes={setBarcodeManagerProduct}
              onManageSuppliers={setSupplierManagerProduct}
              onAdjustInventory={goToInventoryAdjustment}
              getPrimaryImage={getPrimaryImage}
              selectedIds={selectedProductIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
            />
          </CardContent>
        </Card>
      )}

      {/* Floating bulk action bar */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5">
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            {selectedProductIds.size} {selectedProductIds.size === 1 ? 'producto' : 'productos'} seleccionado{selectedProductIds.size !== 1 ? 's' : ''}
          </span>
          <div className="h-5 w-px bg-gray-200" />
          {/* Action selector */}
          <select
            value={bulkAction || ''}
            onChange={(e) => setBulkAction((e.target.value as any) || null)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-admin-500"
          >
            <option value="">Elegir acción…</option>
            <option value="status">Cambiar estado</option>
            <option value="category">Cambiar categoría</option>
            <option value="price">Ajustar precio %</option>
          </select>
          {/* Contextual inputs */}
          {bulkAction === 'status' && (
            <select
              value={bulkStatusValue}
              onChange={(e) => setBulkStatusValue(e.target.value as 'active' | 'inactive')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-admin-500"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          )}
          {bulkAction === 'category' && (
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-admin-500"
            >
              <option value="">Categoría…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {bulkAction === 'price' && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={bulkPricePct}
                onChange={(e) => setBulkPricePct(e.target.value)}
                placeholder="ej: 10 o -5"
                className="w-24 text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-admin-500"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          )}
          <Button
            size="sm"
            onClick={applyBulkAction}
            disabled={!bulkAction || bulkLoading || (bulkAction === 'category' && !bulkCategoryId) || (bulkAction === 'price' && !bulkPricePct)}
            isLoading={bulkLoading}
          >
            Aplicar
          </Button>
          <button
            type="button"
            onClick={() => { setSelectedProductIds(new Set()); setBulkAction(null) }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg mb-4">
            {hasActiveFilters
              ? 'No se encontraron productos con los filtros seleccionados'
              : 'No hay productos disponibles'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {!loading && totalFiltered > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Página {safePage + 1} de {totalPages}
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

      </> /* end activeTab === 'products' */
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingProduct(null)
                    setProductImages([])
                    setInitialBranchId('')
                    setSelectedCategoryIds([])
                    reset()
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nombre"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    {...register('description')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Precio"
                    type="number"
                    step="0.01"
                    {...register('price', { valueAsNumber: true })}
                    error={errors.price?.message}
                  />
                  {editingProduct ? (
                    <div>
                      <input type="hidden" {...register('stock', { valueAsNumber: true })} />
                      <Input
                        label="Stock total (solo lectura)"
                        type="number"
                        value={editingProduct.inventory_stock ?? 0}
                        readOnly
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        El stock se gestiona por sucursal en Inventario.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => goToInventoryAdjustment(editingProduct)}
                      >
                        Ajustar en Inventario
                      </Button>
                    </div>
                  ) : (
                    <Input
                      label="Stock inicial"
                      type="number"
                      {...register('stock', { valueAsNumber: true })}
                      error={errors.stock?.message}
                    />
                  )}
                </div>
                {!editingProduct && branches.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sucursal para stock inicial
                    </label>
                    <select
                      value={initialBranchId}
                      onChange={(e) => setInitialBranchId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                    >
                      <option value="">Ninguna (sin cargar inventario)</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} {branch.code && `(${branch.code})`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Si indicas stock, selecciona la sucursal donde se cargará. El inventario se
                      actualizará automáticamente.
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categorías
                    <span className="ml-1 text-xs font-normal text-gray-500">(seleccioná una o más)</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategoryIds((prev) => [...prev, cat.id])
                            } else {
                              setSelectedCategoryIds((prev) => prev.filter((id) => id !== cat.id))
                            }
                          }}
                          className="h-4 w-4 text-admin-600 focus:ring-admin-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{cat.name}</span>
                      </label>
                    ))}
                    {categories.length === 0 && (
                      <p className="text-sm text-gray-500">No hay categorías disponibles</p>
                    )}
                  </div>
                  {selectedCategoryIds.length === 0 && (
                    <p className="mt-1 text-sm text-red-600">Seleccioná al menos una categoría</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      SKU
                    </label>
                    {editingProduct && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBarcodeManagerProduct(editingProduct)}
                        className="text-xs"
                      >
                        <Package className="h-3 w-3 mr-1" />
                        Códigos de Barras
                      </Button>
                    )}
                  </div>
                  <Input
                    {...register('sku')}
                    error={errors.sku?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imágenes del Producto ({productImages.length} / {maxProductImages})
                    {tier === 'starter' && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        Plan Starter: 1 imagen. Actualizá a Profesional para hasta 3.
                      </span>
                    )}
                  </label>

                  {/* Existing Images */}
                  {productImages.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {productImages.map((image, index) => (
                        <div
                          key={index}
                          className="relative border border-gray-300 rounded-lg p-3 bg-gray-50"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <img
                                src={image.preview || image.image_url}
                                alt={`Imagen ${index + 1}`}
                                className="w-20 h-20 object-cover rounded border border-gray-300"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                {image.is_primary && (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <Star className="h-3 w-3 mr-1" />
                                    Principal
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  Orden: {image.display_order + 1}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => setPrimaryImage(index)}
                                  disabled={image.is_primary}
                                  className="p-1 text-xs text-gray-600 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Marcar como principal"
                                >
                                  <Star className={`h-4 w-4 ${image.is_primary ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveImage(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Mover arriba"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveImage(index, 'down')}
                                  disabled={index === productImages.length - 1}
                                  className="p-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Mover abajo"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="p-1 text-xs text-red-600 hover:text-red-800"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Image Buttons - ocultos o deshabilitados cuando se alcanza el límite */}
                  {productImages.length < maxProductImages && (
                    <div className="space-y-2">
                      <label className="block cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageAdd}
                          multiple
                          className="hidden"
                        />
                        <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          <Upload className="h-5 w-5 mr-2" />
                          <span className="text-sm text-gray-700">
                            Subir imágenes
                          </span>
                        </div>
                      </label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="url"
                          placeholder="https://ejemplo.com/imagen.jpg"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.target as HTMLInputElement
                              handleImageUrlAdd(input.value)
                              input.value = ''
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement
                            if (input) {
                              handleImageUrlAdd(input.value)
                              input.value = ''
                            }
                          }}
                        >
                          Agregar URL
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {maxProductImages === 1
                          ? 'Una imagen por producto (Plan Starter).'
                          : `Hasta ${maxProductImages} imágenes. La primera será la principal.`}
                      </p>
                    </div>
                  )}
                  {productImages.length >= maxProductImages && (
                    <p className="text-sm text-gray-500 mt-1">
                      Límite alcanzado ({maxProductImages} imagen{maxProductImages !== 1 ? 'es' : ''}). Eliminá una para agregar otra.
                    </p>
                  )}
                </div>
                <div className="border border-gray-200 rounded-lg p-4 bg-amber-50/50">
                  <p className="text-sm font-medium text-gray-700 mb-3">Descuento</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Porcentaje (%)</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        placeholder="ej: 20"
                        {...register('discount_percentage', { valueAsNumber: true })}
                        error={errors.discount_percentage?.message}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Válido hasta</label>
                      <input
                        type="datetime-local"
                        {...register('discount_expires_at')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                      />
                      <p className="mt-1 text-xs text-gray-400">Dejá vacío para descuento sin límite</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('is_active')}
                    className="h-4 w-4 text-admin-600 focus:ring-admin-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Producto activo
                  </label>
                </div>
                <div className="flex space-x-4">
                  <Button type="submit" className="flex-1" isLoading={uploadingImage}>
                    {editingProduct ? 'Actualizar' : 'Crear'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingProduct(null)
                      setProductImages([])
                      setInitialBranchId('')
                      setSelectedCategoryIds([])
                      reset()
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {variantManagerProduct && (
        <VariantManager
          product={variantManagerProduct}
          onClose={() => setVariantManagerProduct(null)}
        />
      )}

      {barcodeManagerProduct && (
        <BarcodeManager
          productId={barcodeManagerProduct.id}
          onClose={() => setBarcodeManagerProduct(null)}
        />
      )}

      {barcodeManagerVariant && (
        <BarcodeManager
          productId={barcodeManagerVariant.productId}
          variantId={barcodeManagerVariant.variantId}
          onClose={() => setBarcodeManagerVariant(null)}
        />
      )}

      {supplierManagerProduct && (
        <ProductSupplierManager
          productId={supplierManagerProduct.id}
          onClose={() => setSupplierManagerProduct(null)}
        />
      )}

      {isImportModalOpen && organizationId && (
        <ProductImportModal
          organizationId={organizationId}
          branches={branches}
          onClose={() => setIsImportModalOpen(false)}
          onImported={() => {
            fetchProducts()
            fetchDiscountedProducts()
          }}
        />
      )}
    </div>
  )
}

export function AdminProducts() {
  return <AdminProductsContent />
}
