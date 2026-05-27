import { Edit, Trash2, Package, Image as ImageIcon, ScanLine, Truck, ChevronDown, ChevronRight } from 'lucide-react'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import type { Product, ProductImage, Category, ProductVariant } from '@/types'
import { Fragment, useState } from 'react'

interface ProductWithCategory extends Product {
  product_images?: ProductImage[]
  category?: Category | null
  inventory_stock?: number
}

interface ProductVariantWithInventory extends ProductVariant {
  inventory_stock?: number
}

interface ProductTableProps {
  products: ProductWithCategory[]
  variantsByProduct?: Record<string, ProductVariantWithInventory[]>
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onManageVariants: (product: Product) => void
  onManageBarcodes?: (product: Product) => void
  onManageSuppliers?: (product: Product) => void
  onAdjustInventory?: (product: Product) => void
  getPrimaryImage: (product: ProductWithCategory) => string | null
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onSelectAll?: (allSelected: boolean) => void
}

export function ProductTable({
  products,
  variantsByProduct = {},
  onEdit,
  onDelete,
  onManageVariants,
  onManageBarcodes,
  onManageSuppliers,
  onAdjustInventory,
  getPrimaryImage,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: ProductTableProps) {
  const settings = useOrgSettings()
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())
  const bulkEnabled = !!onToggleSelect
  const allSelected = bulkEnabled && products.length > 0 && products.every((p) => selectedIds?.has(p.id))

  const toggleExpandedProduct = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No se encontraron productos"
        description="Crea tu primer producto o ajusta los filtros de búsqueda."
      />
    )
  }

  return (
    <>
      {/* Vista cards en mobile */}
      <div className="md:hidden space-y-4">
        {products.map((product) => {
          const primaryImage = getPrimaryImage(product)
          const variants = variantsByProduct[product.id] || []
          const hasVariants = variants.length > 0
          const isExpanded = expandedProductIds.has(product.id)
          const mobileStock = product.inventory_stock ?? product.stock ?? 0
          return (
            <div
              key={product.id}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  {primaryImage ? (
                    <img src={primaryImage} alt={capitalizeFirst(product.name)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{capitalizeFirst(product.name)}</p>
                  <p className="text-xs text-gray-500">{product.sku}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm font-medium text-gray-900">{formatPrice(product.price, settings)}</p>
                    <span className={`text-xs font-semibold ${
                      mobileStock === 0
                        ? 'text-red-600'
                        : mobileStock <= (product.low_stock_threshold || 10)
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>
                      Stock: {mobileStock}
                    </span>
                  </div>
                  {hasVariants && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedProduct(product.id)}
                      className="mt-1 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {variants.length} variante{variants.length === 1 ? '' : 's'}
                    </button>
                  )}
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                      product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              {hasVariants && isExpanded && (
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 space-y-2">
                  {variants.map((variant) => {
                    const variantStock = variant.inventory_stock ?? variant.stock ?? 0
                    return (
                      <div key={variant.id} className="rounded bg-white px-2 py-1.5 text-xs border border-gray-100">
                        <div className="font-medium text-gray-800">{variant.name || 'Variante'}</div>
                        <div className="text-gray-500">SKU: {variant.sku}</div>
                        <div className="text-gray-500">
                          Precio: {formatPrice(variant.price ?? product.price, settings)} | Stock: {variantStock}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="min-h-[44px] min-w-[44px] flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-admin-500"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onManageVariants(product)}
                  className="min-h-[44px] min-w-[44px] flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-admin-500"
                >
                  <Package className="h-4 w-4" />
                  Variantes
                </button>
                <div className="min-h-[44px] min-w-[44px] flex items-center">
                  <ActionsMenu
                    actions={[
                      ...(onManageBarcodes ? [{ label: 'Código de barras', icon: <ScanLine className="h-4 w-4" />, onClick: () => onManageBarcodes(product) }] : []),
                      ...(onManageSuppliers ? [{ label: 'Proveedores', icon: <Truck className="h-4 w-4" />, onClick: () => onManageSuppliers(product) }] : []),
                      ...(onAdjustInventory ? [{ label: 'Ajustar inventario', icon: <Package className="h-4 w-4" />, onClick: () => onAdjustInventory(product) }] : []),
                      { label: 'Eliminar', icon: <Trash2 className="h-4 w-4" />, onClick: () => onDelete(product.id), variant: 'danger' as const },
                    ]}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vista tabla en desktop */}
      <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            {bulkEnabled && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                />
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Imagen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 w-24 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categoría
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => {
            const primaryImage = getPrimaryImage(product)
            const displayStock = product.inventory_stock ?? product.stock ?? 0
            const variants = variantsByProduct[product.id] || []
            const hasVariants = variants.length > 0
            const isExpanded = expandedProductIds.has(product.id)
            return (
              <Fragment key={product.id}>
              <tr className={`hover:bg-gray-50 transition-colors ${selectedIds?.has(product.id) ? 'bg-admin-50' : ''}`}>
                {bulkEnabled && (
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(product.id) ?? false}
                      onChange={() => onToggleSelect?.(product.id)}
                      className="h-4 w-4 rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap align-top">
                  <div className="flex-shrink-0 h-12 w-12">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={capitalizeFirst(product.name)}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="text-sm font-medium text-gray-900">{capitalizeFirst(product.name)}</div>
                  {product.description && (
                    <div className="text-sm text-gray-500 line-clamp-1">
                      {capitalizeFirst(product.description)}
                    </div>
                  )}
                  {hasVariants && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedProduct(product.id)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {variants.length} variante{variants.length === 1 ? '' : 's'}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4 !w-8 align-top" title={product.sku}>
                  <div className="text-xs  text-gray-900 truncate line-clamp-1 ">
                    {product.sku}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap align-top">
                  <div className="text-sm text-gray-500">
                    {product.category?.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap align-top">
                  <div className="text-sm font-medium text-gray-900">
                    {formatPrice(product.price, settings)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap align-top">
                  <div
                    className={`text-sm font-medium ${
                      displayStock > 0
                        ? displayStock <= (product.low_stock_threshold || 10)
                          ? 'text-yellow-600'
                          : 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {displayStock}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap align-top">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                  <div className="flex items-center justify-end">
                    <ActionsMenu
                      actions={[
                        {
                          label: 'Gestionar variantes',
                          icon: <Package className="h-4 w-4" />,
                          onClick: () => onManageVariants(product),
                        },
                        ...(onManageBarcodes
                          ? [
                              {
                                label: 'Código de barras',
                                icon: <ScanLine className="h-4 w-4" />,
                                onClick: () => onManageBarcodes(product),
                              },
                            ]
                          : []),
                        ...(onManageSuppliers
                          ? [
                              {
                                label: 'Proveedores',
                                icon: <Truck className="h-4 w-4" />,
                                onClick: () => onManageSuppliers(product),
                              },
                            ]
                          : []),
                        ...(onAdjustInventory
                          ? [
                              {
                                label: 'Ajustar inventario',
                                icon: <Package className="h-4 w-4" />,
                                onClick: () => onAdjustInventory(product),
                              },
                            ]
                          : []),
                        {
                          label: 'Editar',
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => onEdit(product),
                        },
                        {
                          label: 'Eliminar',
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => onDelete(product.id),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
              {hasVariants && isExpanded && (
                <tr className="bg-gray-50">
                  <td className="px-6 py-3" colSpan={8}>
                    <div className="rounded-lg border border-gray-200 bg-white">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100">
                        Variantes de {capitalizeFirst(product.name)}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                            <tr>
                              <th className="px-4 py-2 text-left">Variante</th>
                              <th className="px-4 py-2 text-left">SKU</th>
                              <th className="px-4 py-2 text-left">Precio</th>
                              <th className="px-4 py-2 text-left">Stock</th>
                              <th className="px-4 py-2 text-left">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((variant) => {
                              const variantStock = variant.inventory_stock ?? variant.stock ?? 0
                              return (
                                <tr key={variant.id} className="border-t border-gray-100">
                                  <td className="px-4 py-2 font-medium text-gray-800">
                                    {variant.name || 'Variante'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">{variant.sku}</td>
                                  <td className="px-4 py-2 text-gray-700">
                                    {formatPrice(variant.price ?? product.price, settings)}
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">{variantStock}</td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                        variant.is_active === false
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-green-100 text-green-700'
                                      }`}
                                    >
                                      {variant.is_active === false ? 'Inactiva' : 'Activa'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
