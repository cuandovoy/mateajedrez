import { useOrgSettings } from '@/hooks/useOrgSettings'
import type { POSCartItem } from '@/lib/posService'
import { formatPrice } from '@/lib/utils'
import { Minus, Plus, Trash2 } from 'lucide-react'

interface POSCartItemProps {
  item: POSCartItem
  onRemove: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
}

export function POSCartItemRow({ item, onRemove, onUpdateQuantity }: POSCartItemProps) {
  const settings = useOrgSettings()

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
      {/* Imagen o placeholder */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.product_name}
          className="h-11 w-11 rounded-lg object-cover flex-shrink-0 bg-gray-100"
        />
      ) : (
        <div className="h-11 w-11 rounded-lg bg-gray-100 flex-shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{item.product_name}</p>
        {item.variant_name && (
          <p className="text-xs text-gray-500 truncate">{item.variant_name}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">
          {formatPrice(item.price, settings)} c/u
        </p>
      </div>

      {/* Controles cantidad + precio total + eliminar */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <p className="text-sm font-semibold text-gray-900">
          {formatPrice(item.price * item.quantity, settings)}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onRemove(item.id)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-red-400 hover:bg-red-50 active:scale-95 transition-transform"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg h-7 px-1">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="h-5 w-5 flex items-center justify-center rounded text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs font-semibold text-gray-800 w-6 text-center tabular-nums">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="h-5 w-5 flex items-center justify-center rounded text-gray-600 active:scale-95 transition-transform"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
