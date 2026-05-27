import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ArrowDown, ArrowUp, History, Minus, Truck, X } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

const PAGE_SIZE = 25

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
  const settings = useOrgSettings()
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  const fetchMovements = useCallback(async (pageNum: number, append = false) => {
    try {
      if (pageNum === 0) setLoading(true)
      else setLoadingMore(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_inventory_movements', {
        p_branch_inventory_id: branchInventoryId,
        p_limit: PAGE_SIZE + 1,
        p_offset: pageNum * PAGE_SIZE,
      })

      if (error) throw error
      const result = ((data || []) as Movement[])
      const moreAvailable = result.length > PAGE_SIZE
      if (moreAvailable) result.pop()
      setHasMore(moreAvailable)
      setMovements((prev) => append ? [...prev, ...result] : result)
    } catch (error) {
      console.error('Error fetching movements:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [branchInventoryId])

  useEffect(() => {
    fetchMovements(0)
  }, [fetchMovements])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovements(nextPage, true)
  }

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
        <CardContent className="flex-1 overflow-y-auto pt-4">
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
            <>
              <div className="divide-y divide-gray-100">
                {movements.map((movement) => (
                  <div key={movement.id} className="flex items-start gap-3 py-3 first:pt-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getMovementTypeColor(movement.movement_type)}`}>
                          {getMovementTypeLabel(movement.movement_type)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {movement.previous_stock} → {movement.new_stock}
                        </span>
                        {movement.supplier_name && (
                          <span className="text-xs text-blue-600 flex items-center gap-0.5">
                            <Truck className="h-3 w-3" />
                            {movement.supplier_name}
                          </span>
                        )}
                      </div>
                      {movement.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{movement.notes}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDateTime(movement.created_at, settings)}
                        {movement.user_email && ` · ${movement.user_email}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {movement.quantity > 0 ? (
                        <span className="text-green-600 font-semibold text-sm flex items-center gap-0.5">
                          <ArrowUp className="h-3.5 w-3.5" />+{movement.quantity}
                        </span>
                      ) : movement.quantity < 0 ? (
                        <span className="text-red-600 font-semibold text-sm flex items-center gap-0.5">
                          <ArrowDown className="h-3.5 w-3.5" />{movement.quantity}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-semibold text-sm flex items-center gap-0.5">
                          <Minus className="h-3.5 w-3.5" />0
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div className="pt-4 pb-2 text-center">
                  <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
