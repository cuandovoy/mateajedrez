import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { trackAuditAction } from '@/lib/audit'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { X, Edit } from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import { useToastStore } from '@/store/toastStore'

interface InventoryAdjustmentModalProps {
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

export function InventoryAdjustmentModal({
  inventoryItem,
  onClose,
  onSuccess,
}: InventoryAdjustmentModalProps) {
  const { organizationId } = useOrganization()
  const { show } = useToastStore()
  const [newStock, setNewStock] = useState(inventoryItem.current_stock.toString())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const difference = parseInt(newStock) - inventoryItem.current_stock

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const stock = parseInt(newStock, 10)
    if (isNaN(stock) || stock < 0) {
      show('El stock debe ser un número mayor o igual a 0', 'error')
      return
    }

    if (stock === inventoryItem.current_stock) {
      show('El stock no ha cambiado', 'error')
      return
    }

    setLoading(true)

    try {
      const previousStock = inventoryItem.current_stock
      const quantityChange = stock - previousStock

      const { error: updateError } = await supabase
        .from('branch_inventory')
        .update({ stock })
        .eq('id', inventoryItem.id)

      if (updateError) throw updateError

      await supabase
        .from('inventory_movements')
        .insert({
          branch_inventory_id: inventoryItem.id,
          movement_type: 'adjustment',
          quantity: quantityChange,
          previous_stock: previousStock,
          new_stock: stock,
          reference_type: 'manual',
          notes: notes || null,
        })

      await trackAuditAction({
        organizationId,
        tableName: 'branch_inventory',
        recordId: inventoryItem.id,
        action: 'UPDATE',
        notes: 'Ajuste manual de inventario desde modal de inventario.',
        oldData: { stock: previousStock },
        newData: {
          stock,
          quantity_change: quantityChange,
          reason: notes || null,
          branch_id: inventoryItem.branch_id,
          product_id: inventoryItem.product_id,
          variant_id: inventoryItem.variant_id,
        },
      })

      show(
        `Ajuste manual realizado: ${difference > 0 ? '+' : ''}${difference} unidades (${inventoryItem.current_stock} → ${stock})`,
        'success'
      )
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error adjusting inventory:', error)
      show(error.message || 'Error al realizar el ajuste', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 pt-4 sm:items-center sm:p-4">
      <Card className="flex w-full max-w-md max-h-[95vh] flex-col overflow-hidden sm:max-h-[90vh]">
        <CardHeader className="border-b pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-xl">
              <Edit className="h-5 w-5 text-admin-600" />
              <span>Ajuste manual de inventario</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-4 sm:pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Este ajuste es operativo y no genera compra, factura ni egreso contable. Para movimientos de compra usa el módulo de Compras y Egresos.
            </div>

            <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
              <p className="text-sm text-gray-600 mb-1">Producto</p>
              <p className="font-medium text-gray-900">{inventoryItem.product_name}</p>
              {inventoryItem.variant_name && (
                <p className="text-sm text-gray-600">Variante: {inventoryItem.variant_name}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">Sucursal: {inventoryItem.branch_name}</p>
              <p className="text-sm font-medium text-gray-900 mt-2">
                Stock actual: <span className="text-admin-600">{inventoryItem.current_stock}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nuevo stock contado *
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                placeholder="Nuevo stock"
                required
                autoFocus
              />
              {!isNaN(difference) && difference !== 0 && (
                <p
                  className={`text-sm mt-1 ${
                    difference > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {difference > 0 ? '+' : ''}
                  {difference} unidades ({difference > 0 ? 'aumento' : 'disminución'})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo del ajuste *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                rows={3}
                placeholder="Ej: Conteo físico, merma, rotura, error de sistema..."
                required
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:space-x-4 sm:gap-0 sm:pt-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Guardando ajuste...' : 'Guardar ajuste manual'}
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
