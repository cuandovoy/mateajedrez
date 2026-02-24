import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import type { ProductSupplier, ProductSupplierInsert, Supplier } from '@/types'
import { Package, Plus, Star, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ProductSupplierManagerProps {
  productId: string
  onClose: () => void
}

interface SupplierItem {
  id?: string
  supplier_id: string
  supplier_sku: string
  supplier_price: string
  lead_time_days: string
  min_order_quantity: string
  is_primary: boolean
  notes: string
}

export function ProductSupplierManager({ productId, onClose }: ProductSupplierManagerProps) {
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [productSuppliers, setProductSuppliers] = useState<SupplierItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    supplier_id: '',
    supplier_sku: '',
    supplier_price: '',
    lead_time_days: '',
    min_order_quantity: '1',
    notes: '',
  })

  const availableSuppliers = suppliers.filter(
    (s) => !productSuppliers.some((ps) => ps.supplier_id === s.id),
  )

  useEffect(() => {
    fetchData()
  }, [productId])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch all suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (suppliersError) throw suppliersError
      setSuppliers(suppliersData || [])

      // Fetch product-supplier relationships
      const { data: productSuppliersData, error: productSuppliersError }: { data: ProductSupplier[] | null, error: Error | null } = await supabase
        .from('product_suppliers')
        .select('*')
        .eq('product_id', productId)
        .order('is_primary', { ascending: false })

      if (productSuppliersError) throw productSuppliersError
      setProductSuppliers(
        (productSuppliersData || []).map((ps) => ({
          id: ps.id,
          supplier_id: ps.supplier_id,
          supplier_sku: ps.supplier_sku || '',
          supplier_price: ps.supplier_price?.toString() || '',
          lead_time_days: ps.lead_time_days?.toString() || '',
          min_order_quantity: ps.min_order_quantity?.toString() || '1',
          is_primary: ps.is_primary ?? false,
          notes: ps.notes || '',
        }))
      )
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSupplier = () => {
    if (!newSupplier.supplier_id) {
      alert('Selecciona un proveedor')
      return
    }

    // Check for duplicates
    if (productSuppliers.some((ps) => ps.supplier_id === newSupplier.supplier_id)) {
      alert('Este proveedor ya está asociado al producto')
      return
    }

    const newItem: SupplierItem = {
      supplier_id: newSupplier.supplier_id,
      supplier_sku: newSupplier.supplier_sku,
      supplier_price: newSupplier.supplier_price,
      lead_time_days: newSupplier.lead_time_days,
      min_order_quantity: newSupplier.min_order_quantity || '1',
      is_primary: productSuppliers.length === 0, // First supplier is primary
      notes: newSupplier.notes,
    }

    setProductSuppliers([...productSuppliers, newItem])
    setNewSupplier({
      supplier_id: '',
      supplier_sku: '',
      supplier_price: '',
      lead_time_days: '',
      min_order_quantity: '1',
      notes: '',
    })
  }

  const handleRemoveSupplier = (index: number) => {
    const newSuppliers = productSuppliers.filter((_, i) => i !== index)
    
    // If we removed the primary, make the first one primary
    if (productSuppliers[index].is_primary && newSuppliers.length > 0) {
      newSuppliers[0].is_primary = true
    }
    
    setProductSuppliers(newSuppliers)
  }

  const handleSetPrimary = (index: number) => {
    const newSuppliers = productSuppliers.map((ps, i) => ({
      ...ps,
      is_primary: i === index,
    }))
    setProductSuppliers(newSuppliers)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Delete existing relationships
      const { error: deleteError } = await supabase
        .from('product_suppliers')
        .delete()
        .eq('product_id', productId)

      if (deleteError) throw deleteError

      // Insert new relationships
      if (productSuppliers.length > 0) {
        const suppliersToInsert: ProductSupplierInsert[] = productSuppliers.map((ps) => ({
          product_id: productId,
          supplier_id: ps.supplier_id,
          supplier_sku: ps.supplier_sku || null,
          supplier_price: ps.supplier_price ? parseFloat(ps.supplier_price) : null,
          lead_time_days: ps.lead_time_days ? parseInt(ps.lead_time_days, 10) : null,
          min_order_quantity: parseInt(ps.min_order_quantity || '1', 10),
          is_primary: ps.is_primary,
          notes: ps.notes || null,
        }))

        const { error: insertError }: { error: Error | null } = await supabase
          .from('product_suppliers')
          .insert(suppliersToInsert as never)

        if (insertError) throw insertError
      }

      onClose()
    } catch (error) {
      console.error('Error saving product suppliers:', error)
      alert('Error al guardar los proveedores')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestionar Proveedores del Producto</CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Empty state: no suppliers in the system */}
          {suppliers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <Package className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay proveedores cargados
              </h3>
              <p className="text-gray-600 mb-6 max-w-sm">
                Para asociar proveedores a este producto, primero debes crear proveedores en el
                sistema. Los proveedores se gestionan en la sección de administración.
              </p>
              <Button
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/suppliers')
                }}
              >
                Ir a Proveedores
              </Button>
            </div>
          )}

          {/* Existing Suppliers */}
          {productSuppliers.length > 0 && suppliers.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Proveedores Asociados
              </label>
              {productSuppliers.map((ps, index) => {
                const supplier = suppliers.find((s) => s.id === ps.supplier_id)
                return (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {ps.is_primary && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Star className="h-3 w-3 mr-1" />
                            Principal
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {supplier?.name || 'Proveedor desconocido'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        {ps.supplier_sku && (
                          <div>
                            <span className="font-medium">SKU Proveedor:</span> {ps.supplier_sku}
                          </div>
                        )}
                        {ps.supplier_price && (
                          <div>
                            <span className="font-medium">Precio:</span> ${ps.supplier_price}
                          </div>
                        )}
                        {ps.lead_time_days && (
                          <div>
                            <span className="font-medium">Tiempo entrega:</span> {ps.lead_time_days} días
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Cant. mínima:</span> {ps.min_order_quantity}
                        </div>
                      </div>
                      {ps.notes && (
                        <div className="text-xs text-gray-500 mt-1">{ps.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        disabled={ps.is_primary}
                        className="p-1 text-xs text-gray-600 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Marcar como principal"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            ps.is_primary ? 'fill-yellow-400 text-yellow-400' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSupplier(index)}
                        className="p-1 text-xs text-red-600 hover:text-red-800"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add New Supplier - only when there are suppliers in the system */}
          {suppliers.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              {productSuppliers.length === 0 && (
                <p className="text-sm text-gray-600">
                  Este producto aún no tiene proveedores asociados. Selecciona uno y completa los
                  datos para agregarlo.
                </p>
              )}
              {availableSuppliers.length === 0 && productSuppliers.length > 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  Todos los proveedores ya están asociados a este producto.
                </p>
              )}
              {availableSuppliers.length > 0 && (
                <>
                  <label className="block text-sm font-medium text-gray-700">
                    Agregar Proveedor
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Proveedor *
                      </label>
                      <select
                        value={newSupplier.supplier_id}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, supplier_id: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                      >
                        <option value="">Seleccionar proveedor</option>
                        {availableSuppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        type="text"
                        label="SKU del Proveedor"
                        placeholder="SKU del proveedor"
                        value={newSupplier.supplier_sku}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, supplier_sku: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        label="Precio del Proveedor"
                        placeholder="0.00"
                        value={newSupplier.supplier_price}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, supplier_price: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        label="Tiempo de Entrega (días)"
                        placeholder="Ej: 7"
                        value={newSupplier.lead_time_days}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, lead_time_days: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        label="Cantidad Mínima de Pedido"
                        placeholder="1"
                        value={newSupplier.min_order_quantity}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, min_order_quantity: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Input
                        type="text"
                        label="Notas (opcional)"
                        placeholder="Información adicional sobre este proveedor"
                        value={newSupplier.notes}
                        onChange={(e) =>
                          setNewSupplier({ ...newSupplier, notes: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddSupplier}
                      variant="outline"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Proveedor
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-4 border-t">
            {suppliers.length > 0 ? (
              <>
                <Button
                  type="button"
                  onClick={handleSave}
                  className="flex-1"
                  isLoading={saving}
                >
                  Guardar
                </Button>
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancelar
                </Button>
              </>
            ) : (
              <Button type="button" onClick={onClose} className="w-full">
                Cerrar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
