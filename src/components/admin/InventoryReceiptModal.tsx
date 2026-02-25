import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { trackAuditAction } from '@/lib/audit'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { X, Package, Truck } from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import { useToastStore } from '@/store/toastStore'
import type { Supplier } from '@/types'

interface InventoryReceiptModalProps {
  inventoryItem: {
    id: string
    branch_id: string
    branch_name: string
    product_id: string | null
    variant_id: string | null
    product_name: string
    variant_name?: string | null
    current_stock: number
  }
  onClose: () => void
  onSuccess: () => void
}

export function InventoryReceiptModal({
  inventoryItem,
  onClose,
  onSuccess,
}: InventoryReceiptModalProps) {
  const { organizationId } = useOrganization()
  const { show } = useToastStore()
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [supplierId, setSupplierId] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setSuppliers([])
      setLoadingSuppliers(false)
      return
    }
    fetchSuppliers(organizationId)
  }, [organizationId])

  const fetchSuppliers = async (orgId: string) => {
    try {
      setLoadingSuppliers(true)
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setSuppliers((data || []) as Supplier[])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      show('La cantidad debe ser mayor a 0', 'error')
      return
    }

    setLoading(true)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('receive_inventory', {
        p_branch_inventory_id: inventoryItem.id,
        p_quantity: qty,
        p_notes: notes || null,
        p_supplier_id: supplierId || null,
      } as any)

      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'inventory_movements',
        recordId: inventoryItem.id,
        action: 'INSERT',
        notes: 'Ingreso manual de stock desde modal de inventario (sin impacto contable).',
        newData: {
          quantity: qty,
          branch_id: inventoryItem.branch_id,
          product_id: inventoryItem.product_id,
          variant_id: inventoryItem.variant_id,
          supplier_id: supplierId || null,
          notes: notes || null,
        },
      })

      show(`Ingreso manual registrado: +${qty} unidades (sin impacto contable)`, 'success')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error receiving inventory:', error)
      show(error.message || 'Error al registrar la recepción', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center space-x-2">
              <Package className="h-5 w-5 text-admin-600" />
              <span>Ingreso manual de stock</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Este ingreso es manual y no genera compra, factura ni egreso contable. Para compras reales usa el modulo de Compras y Egresos.
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Producto</p>
              <p className="font-medium text-gray-900">{inventoryItem.product_name}</p>
              {inventoryItem.variant_name && (
                <p className="text-sm text-gray-600">Variante: {inventoryItem.variant_name}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">Sucursal: {inventoryItem.branch_name}</p>
              <p className="text-sm text-gray-600">Stock actual: {inventoryItem.current_stock}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad a ingresar *
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cantidad"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proveedor (opcional, solo referencia)
              </label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 appearance-none bg-white"
                  disabled={loadingSuppliers}
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              {suppliers.length === 0 && !loadingSuppliers && (
                <p className="text-xs text-gray-500 mt-1">
                  No hay proveedores activos. Puedes crear uno en la sección de Proveedores.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                rows={3}
                placeholder="Ej: Orden #123, Factura #456, Notas adicionales..."
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Registrando...' : 'Registrar ingreso manual'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
