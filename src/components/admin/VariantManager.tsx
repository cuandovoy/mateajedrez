import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { ProductVariant, Product } from '@/types'
import { VariantForm } from './VariantForm'

interface VariantManagerProps {
  product: Product
  onClose: () => void
}

export function VariantManager({ product, onClose }: VariantManagerProps) {
  const { show } = useToastStore()
  const settings = useOrgSettings()
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)

  useEffect(() => {
    fetchVariants()
  }, [product.id])

  const fetchVariants = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVariants(data || [])
    } catch (error) {
      console.error('Error fetching variants:', error)
      show('Error al cargar las variantes', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (variantId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta variante?')) return

    try {
      const { error } = await (supabase
        .from('product_variants') as any)
        .delete()
        .eq('id', variantId)

      if (error) throw error
      show('Variante eliminada exitosamente', 'success')
      fetchVariants()
    } catch (error) {
      console.error('Error deleting variant:', error)
      show('Error al eliminar la variante', 'error')
    }
  }

  const handleEdit = (variant: ProductVariant) => {
    setEditingVariant(variant)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingVariant(null)
    fetchVariants()
  }

  const getAttributesDisplay = (attributes: any): string => {
    if (!attributes || typeof attributes !== 'object') return 'Sin atributos'
    return Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Gestionar Variantes - {product.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {isFormOpen ? (
            <VariantForm
              product={product}
              variant={editingVariant}
              onClose={handleFormClose}
            />
          ) : (
            <>
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {variants.length} variante{variants.length !== 1 ? 's' : ''} encontrada{variants.length !== 1 ? 's' : ''}
                </p>
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Variante
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
                </div>
              ) : variants.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">No hay variantes para este producto</p>
                  <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primera Variante
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Nombre</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Atributos</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Precio</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant) => (
                        <tr key={variant.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-sm text-gray-600">
                            {variant.sku}
                          </td>
                          <td className="py-3 px-4">
                            {variant.name || 'Sin nombre'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {getAttributesDisplay(variant.attributes)}
                          </td>
                          <td className="py-3 px-4">
                            {variant.price ? formatPrice(variant.price, settings) : formatPrice(product.price, settings)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={variant.stock <= (variant.low_stock_threshold || 10) ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                              {variant.stock} {variant.unit || product.unit || 'unidad'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                variant.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {variant.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(variant)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(variant.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
