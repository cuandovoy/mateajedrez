import { Button } from '@/components/ui/Button'
import type { LotWithDetails } from '@/hooks/useLots'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { AlertTriangle, Calendar, Clock, Package, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LotWriteOffModal } from './LotWriteOffModal'

interface Movement {
  id: string
  movement_type: string
  quantity: number
  created_at: string | null
}

interface LotDetailPanelProps {
  lot: LotWithDetails
  onWriteOff?: (id: string, reason: string, quantity: number) => Promise<void>
  onLoadMovements: (lotId: string) => Promise<Movement[]>
  onClose: () => void
}

const URGENCY_LABEL: Record<LotWithDetails['urgency'], string> = {
  critical: 'Vence pronto',
  warning: 'Por vencer',
  ok: 'Sin urgencia',
  none: '',
}

const MOVEMENT_LABEL: Record<string, string> = {
  sale: 'Vendidas',
  adjustment: 'Ajuste',
  transfer_out: 'Transferidas',
  lot_adjustment: 'Baja de lote',
  return: 'Devolución',
}

export function LotDetailPanel({ lot, onWriteOff, onLoadMovements, onClose }: LotDetailPanelProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(true)
  const [showWriteOff, setShowWriteOff] = useState(false)

  useEffect(() => {
    setLoadingMovements(true)
    onLoadMovements(lot.id)
      .then(setMovements)
      .finally(() => setLoadingMovements(false))
  }, [lot.id, onLoadMovements])

  const urgencyColor = {
    critical: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    ok: 'text-green-600 bg-green-50',
    none: 'text-gray-500 bg-gray-50',
  }[lot.urgency]

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{lot.product_name}</h3>
            {lot.variant_name && <p className="text-xs text-gray-500 mt-0.5">{lot.variant_name}</p>}
            {lot.urgency !== 'none' && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1.5', urgencyColor)}>
                <AlertTriangle className="h-3 w-3" />
                {URGENCY_LABEL[lot.urgency]}
              </span>
            )}
          </div>
          <button onClick={onClose} className="ml-2 p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Detalle */}
        <div className="p-4 space-y-3 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Recibido</p>
                <p className="font-medium text-gray-800">
                  {new Date(lot.received_at).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            </div>

            {lot.expires_at && (
              <div className="flex items-center gap-2 text-gray-600">
                <AlertTriangle className={cn('h-4 w-4 shrink-0', lot.urgency === 'critical' ? 'text-red-400' : lot.urgency === 'warning' ? 'text-amber-400' : 'text-gray-400')} />
                <div>
                  <p className="text-xs text-gray-400">Vence</p>
                  <p className={cn('font-medium', lot.urgency === 'critical' ? 'text-red-600' : lot.urgency === 'warning' ? 'text-amber-600' : 'text-gray-800')}>
                    {new Date(lot.expires_at).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-600">
              <Package className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Stock restante</p>
                <p className="font-medium text-gray-800">{lot.quantity_remaining} <span className="text-gray-400 font-normal">de {lot.quantity_received}</span></p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">En depósito</p>
                <p className={cn('font-medium', lot.days_in_storage >= 60 ? 'text-amber-600' : 'text-gray-800')}>
                  {lot.days_in_storage} días
                </p>
              </div>
            </div>
          </div>

          {(lot.branch_name || lot.supplier_name || lot.unit_cost) && (
            <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
              {lot.branch_name && <p>Sucursal: <span className="text-gray-700">{lot.branch_name}</span></p>}
              {lot.supplier_name && <p>Proveedor: <span className="text-gray-700">{lot.supplier_name}</span></p>}
              {lot.unit_cost && <p>Costo unitario: <span className="text-gray-700">{formatPrice(lot.unit_cost)}</span></p>}
              {lot.reference_document && <p>Remito: <span className="text-gray-700 font-mono">{lot.reference_document}</span></p>}
            </div>
          )}
        </div>

        {/* Acciones */}
        {onWriteOff && (
          <div className="p-4 border-b border-gray-100 space-y-2">
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowWriteOff(true)}
            >
              Registrar baja
            </Button>
          </div>
        )}

        {/* Historial de movimientos */}
        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Movimientos</h4>
          {loadingMovements ? (
            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin movimientos registrados</p>
          ) : (
            <ul className="space-y-2">
              {movements.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-700">{MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}</span>
                    <span className="text-gray-400 text-xs ml-2">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) : ''}
                    </span>
                  </div>
                  <span className={cn('font-medium', m.quantity > 0 ? 'text-green-600' : 'text-red-500')}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity} un.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showWriteOff && (
        <LotWriteOffModal
          lot={lot}
          onConfirm={async (reason, qty) => { if (onWriteOff) await onWriteOff(lot.id, reason, qty) }}
          onClose={() => setShowWriteOff(false)}
        />
      )}
    </>
  )
}
