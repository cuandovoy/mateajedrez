import { Edit, Trash2, Package, Image as ImageIcon, ScanLine, Truck } from 'lucide-react'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import type { Product, ProductImage, Category } from '@/types'

interface ProductWithCategory extends Product {
  product_images?: ProductImage[]
  category?: Category | null
  inventory_stock?: number
}

interface ProductTableProps {
  products: ProductWithCategory[]
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onManageVariants: (product: Product) => void
  onManageBarcodes?: (product: Product) => void
  onManageSuppliers?: (product: Product) => void
  getPrimaryImage: (product: ProductWithCategory) => string | null
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
  onManageVariants,
  onManageBarcodes,
  onManageSuppliers,
  getPrimaryImage,
}: ProductTableProps) {
  const settings = useOrgSettings()
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
                  <p className="text-sm font-medium text-gray-900 mt-1">{formatPrice(product.price, settings)}</p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                      product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
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
            return (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{capitalizeFirst(product.name)}</div>
                  {product.description && (
                    <div className="text-sm text-gray-500 line-clamp-1">
                      {capitalizeFirst(product.description)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 !w-8" title={product.sku}>
                  <div className="text-xs  text-gray-900 truncate line-clamp-1 ">
                    {product.sku}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {product.category?.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {formatPrice(product.price, settings)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
