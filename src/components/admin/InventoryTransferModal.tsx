import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { X, ArrowRight } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'

interface InventoryTransferModalProps {
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
  branches: Branch[]
  onClose: () => void
  onSuccess: () => void
}

export function InventoryTransferModal({
  inventoryItem,
  branches,
  onClose,
  onSuccess,
}: InventoryTransferModalProps) {
  const { show } = useToastStore()
  const [toBranchId, setToBranchId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const availableBranches = branches.filter((b) => b.id !== inventoryItem.branch_id && b.is_active)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!toBranchId) {
      show('Selecciona una sucursal destino', 'error')
      return
    }

    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      show('La cantidad debe ser mayor a 0', 'error')
      return
    }

    if (qty > inventoryItem.current_stock) {
      show(`Stock insuficiente. Disponible: ${inventoryItem.current_stock}`, 'error')
      return
    }

    setLoading(true)

    try {
      // Type assertion needed because PostgREST types may not be updated after migration 028
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('create_inventory_transfer', {
        p_from_branch_id: inventoryItem.branch_id,
        p_to_branch_id: toBranchId,
        p_quantity: qty,
        p_product_id: inventoryItem.product_id || null,
        p_variant_id: inventoryItem.variant_id || null,
        p_notes: notes || null,
      })

      if (error) throw error

      show(`Transferencia creada: ${qty} unidades a ${branches.find((b) => b.id === toBranchId)?.name}`, 'success')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating transfer:', error)
      show(error.message || 'Error al crear la transferencia', 'error')
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
              <ArrowRight className="h-5 w-5 text-admin-600" />
              <span>Transferencia entre Sucursales</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Producto</p>
              <p className="font-medium text-gray-900">{inventoryItem.product_name}</p>
              {inventoryItem.variant_name && (
                <p className="text-sm text-gray-600">Variante: {inventoryItem.variant_name}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                Desde: <span className="font-medium">{inventoryItem.branch_name}</span>
              </p>
              <p className="text-sm font-medium text-gray-900 mt-2">
                Stock disponible: <span className="text-admin-600">{inventoryItem.current_stock}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sucursal Destino *
              </label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                required
              >
                <option value="">Selecciona una sucursal...</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad a transferir *
              </label>
              <Input
                type="number"
                min="1"
                max={inventoryItem.current_stock}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cantidad"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo disponible: {inventoryItem.current_stock}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                rows={3}
                placeholder="Notas sobre la transferencia..."
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Nota:</strong> El stock se descontará inmediatamente de la sucursal origen.
                La sucursal destino deberá confirmar la recepción para completar la transferencia.
              </p>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button type="submit" className="flex-1" disabled={loading || availableBranches.length === 0}>
                {loading ? 'Creando...' : 'Crear Transferencia'}
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
