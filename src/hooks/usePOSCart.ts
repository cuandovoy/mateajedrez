import type { POSCartItem } from '@/lib/posService'
import { useCallback, useState } from 'react'

export type { POSCartItem }

export function usePOSCart() {
  const [items, setItems] = useState<POSCartItem[]>([])

  const addItem = useCallback((newItem: Omit<POSCartItem, 'id'>) => {
    setItems((prev) => {
      const key = newItem.variant_id ?? newItem.product_id
      if (key && newItem.type === 'product') {
        const existing = prev.find(
          (i) => (i.variant_id ?? i.product_id) === key && i.type === 'product'
        )
        if (existing) {
          return prev.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity + (newItem.quantity ?? 1) } : i
          )
        }
      }
      return [...prev, { ...newItem, id: crypto.randomUUID(), quantity: newItem.quantity ?? 1 }]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty < 1) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return { items, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount }
}
