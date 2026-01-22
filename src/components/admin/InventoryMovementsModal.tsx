import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { ArrowDown, ArrowUp, History, Minus, Truck, X } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

interface InventoryMovementsModalProps {
  branchInventoryId: string
  productName: string
  variantName?: string | null
  onClose: () => void
}

interface Movement {
  id: string
  movement_type: string
  quantity: number
  previous_stock: number
  new_stock: number
  reference_type: string | null
  notes: string | null
  created_by: string | null
  user_email: string | null
  supplier_id: string | null
  supplier_name: string | null
  created_at: string
}

export function InventoryMovementsModal({
  branchInventoryId,
  productName,
  variantName,
  onClose,
}: InventoryMovementsModalProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true)
      // Type assertion needed because PostgREST types may not be updated after migration 026
      // This is a temporary workaround until PostgREST refreshes its schema cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_inventory_movements', {
        p_branch_inventory_id: branchInventoryId,
        p_limit: 100,
        p_offset: 0,
      })

      if (error) throw error
      setMovements((data || []) as Movement[])
    } catch (error) {
      console.error('Error fetching movements:', error)
    } finally {
      setLoading(false)
    }
  }, [branchInventoryId])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      receipt: 'Recepción',
      adjustment: 'Ajuste',
      transfer_out: 'Transferencia (Salida)',
      transfer_in: 'Transferencia (Entrada)',
      sale: 'Venta',
      return: 'Devolución',
      manual: 'Manual',
    }
    return labels[type] || type
  }

  const getMovementTypeColor = (type: string) => {
    if (type === 'receipt' || type === 'transfer_in' || type === 'return') {
      return 'bg-green-100 text-green-800'
    }
    if (type === 'sale' || type === 'transfer_out') {
      return 'bg-red-100 text-red-800'
    }
    if (type === 'adjustment') {
      return 'bg-blue-100 text-blue-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center space-x-2">
              <History className="h-5 w-5 text-admin-600" />
              <span>Historial de Movimientos</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-900">{productName}</p>
            {variantName && <p className="text-xs text-gray-600">Variante: {variantName}</p>}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay movimientos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMovementTypeColor(
                          movement.movement_type
                        )}`}
                      >
                        {getMovementTypeLabel(movement.movement_type)}
                      </span>
                      {movement.quantity > 0 ? (
                        <span className="text-green-600 font-semibold flex items-center space-x-1">
                          <ArrowUp className="h-4 w-4" />
                          <span>+{movement.quantity}</span>
                        </span>
                      ) : movement.quantity < 0 ? (
                        <span className="text-red-600 font-semibold flex items-center space-x-1">
                          <ArrowDown className="h-4 w-4" />
                          <span>{movement.quantity}</span>
                        </span>
                      ) : (
                        <span className="text-gray-600 font-semibold flex items-center space-x-1">
                          <Minus className="h-4 w-4" />
                          <span>0</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Stock: <span className="font-medium">{movement.previous_stock}</span> →{' '}
                      <span className="font-medium">{movement.new_stock}</span>
                    </p>
                    {movement.supplier_name && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center space-x-1">
                        <Truck className="h-3 w-3" />
                        <span>Proveedor: {movement.supplier_name}</span>
                      </p>
                    )}
                    {movement.notes && (
                      <p className="text-xs text-gray-500 mt-1">{movement.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(movement.created_at).toLocaleString('es-UY')}
                      {movement.user_email && ` • ${movement.user_email}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
