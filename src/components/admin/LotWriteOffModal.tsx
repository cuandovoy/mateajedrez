import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { LotWithDetails } from '@/hooks/useLots'
import { X } from 'lucide-react'
import { useState } from 'react'

interface LotWriteOffModalProps {
  lot: LotWithDetails
  onConfirm: (reason: string, quantity: number) => Promise<void>
  onClose: () => void
}

const REASONS = [
  { value: 'expiry', label: 'Vencimiento' },
  { value: 'damage', label: 'Llegó dañado' },
  { value: 'other', label: 'Otro' },
]

export function LotWriteOffModal({ lot, onConfirm, onClose }: LotWriteOffModalProps) {
  const [quantity, setQuantity] = useState(lot.quantity_remaining)
  const [reason, setReason] = useState<string>('expiry')
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const finalReason = reason === 'other' ? customReason.trim() : REASONS.find(r => r.value === reason)!.label
    if (!finalReason) return
    setLoading(true)
    try {
      await onConfirm(finalReason, quantity)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Registrar baja</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{lot.product_name}</span>
            {lot.variant_name && <span className="text-gray-500"> · {lot.variant_name}</span>}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a dar de baja</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center text-lg font-medium hover:bg-gray-50 transition-colors"
              >
                −
              </button>
              <Input
                type="number"
                value={quantity}
                min={1}
                max={lot.quantity_remaining}
                onChange={e => setQuantity(Math.min(lot.quantity_remaining, Math.max(1, Number(e.target.value))))}
                className="text-center w-20"
              />
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(lot.quantity_remaining, q + 1))}
                className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center text-lg font-medium hover:bg-gray-50 transition-colors"
              >
                +
              </button>
              <span className="text-sm text-gray-500">de {lot.quantity_remaining}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo</label>
            <div className="space-y-2">
              {REASONS.map(r => (
                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-admin-600"
                  />
                  <span className="text-sm text-gray-700">{r.label}</span>
                </label>
              ))}
            </div>
            {reason === 'other' && (
              <Input
                className="mt-2"
                placeholder="Describí el motivo..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-100">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={handleConfirm}
            disabled={loading || (reason === 'other' && !customReason.trim())}
          >
            {loading ? 'Guardando...' : 'Confirmar baja'}
          </Button>
        </div>
      </div>
    </div>
  )
}
