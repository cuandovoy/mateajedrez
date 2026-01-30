import { Edit, Trash2, Package, Image as ImageIcon, ScanLine, Truck } from 'lucide-react'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { formatPrice } from '@/lib/utils'
import type { Product, ProductImage, Category } from '@/types'

interface ProductWithCategory extends Product {
  product_images?: ProductImage[]
  category?: Category | null
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
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron productos
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="divide-y divide-gray-200 bg-white">
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
            return (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex-shrink-0 h-12 w-12">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={product.name}
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
                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                  {product.description && (
                    <div className="text-sm text-gray-500 line-clamp-1">
                      {product.description}
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
                    {formatPrice(product.price)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className={`text-sm font-medium ${
                      product.stock > 0
                        ? product.stock <= (product.low_stock_threshold || 10)
                          ? 'text-yellow-600'
                          : 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {product.stock}
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
  )
}
