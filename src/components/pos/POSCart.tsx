import type { POSCartItem } from '@/lib/posService'
import { ShoppingCart } from 'lucide-react'
import { POSCartItemRow } from './POSCartItem'

interface POSCartProps {
  items: POSCartItem[]
  onRemove: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
}

export function POSCart({ items, onRemove, onUpdateQuantity }: POSCartProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6">
        <ShoppingCart className="h-12 w-12 text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-400">El carrito está vacío</p>
        <p className="text-xs text-gray-400 mt-1 text-center">
          Buscá un producto en la pestaña de búsqueda para agregarlo
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((item) => (
        <POSCartItemRow
          key={item.id}
          item={item}
          onRemove={onRemove}
          onUpdateQuantity={onUpdateQuantity}
        />
      ))}
    </div>
  )
}
