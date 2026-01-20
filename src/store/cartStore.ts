import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { CartItemWithProduct, Product } from '@/types'
import { useAuthStore } from './authStore'
import { useToastStore } from './toastStore'

interface LocalCartItem {
  product_id: string
  quantity: number
}

interface CartState {
  items: CartItemWithProduct[]
  loading: boolean
  fetchCart: () => Promise<void>
  addToCart: (productId: string, quantity?: number) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeFromCart: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  getTotal: () => number
  getItemCount: () => number
  syncLocalCart: () => Promise<void>
  loadLocalCart: () => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  loading: false,

  fetchCart: async () => {
    const { user } = useAuthStore.getState()
    
    set({ loading: true })
    try {
      if (user) {
        // Fetch from database
        const { data, error } = await supabase
          .from('cart_items')
          .select(`
            *,
            product:products(*)
          `)
          .eq('user_id', user.id)

        if (error) throw error

        set({
          items: (data || []).map((item: any) => ({
            ...item,
            product: item.product,
          })) as CartItemWithProduct[],
        })
      } else {
        // Load from localStorage
        await get().loadLocalCart()
      }
    } catch (error) {
      console.error('Error fetching cart:', error)
    } finally {
      set({ loading: false })
    }
  },

  loadLocalCart: async () => {
    try {
      const localCart = localStorage.getItem('local_cart')
      if (!localCart) {
        set({ items: [] })
        return
      }

      const localItems: LocalCartItem[] = JSON.parse(localCart)
      
      // Fetch product details for all items
      const productIds = localItems.map(item => item.product_id)
      if (productIds.length === 0) {
        set({ items: [] })
        return
      }

      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('is_active', true)

      if (error) throw error

      // Map local items with product data
      const items: CartItemWithProduct[] = localItems
        .map(localItem => {
          const product = products?.find(p => p.id === localItem.product_id)
          if (!product) return null

          return {
            id: `local_${localItem.product_id}`,
            user_id: '',
            product_id: localItem.product_id,
            quantity: localItem.quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            product: product as Product,
          } as CartItemWithProduct
        })
        .filter((item): item is CartItemWithProduct => item !== null)

      set({ items })
    } catch (error) {
      console.error('Error loading local cart:', error)
      set({ items: [] })
    }
  },

  syncLocalCart: async () => {
    const { user } = useAuthStore.getState()
    if (!user) return

    const localCart = localStorage.getItem('local_cart')
    if (!localCart) return

    try {
      const localItems: LocalCartItem[] = JSON.parse(localCart)
      
      // Sync each item to database
      for (const localItem of localItems) {
        const existingLocalItem = localItems.find(
          li => li.product_id === localItem.product_id
        )

        // Check if item exists in database
        const { data: dbItem } = await supabase
          .from('cart_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('product_id', localItem.product_id)
          .maybeSingle()

        if (dbItem) {
          // Update quantity
          await supabase
            .from('cart_items')
            .update({ quantity: dbItem.quantity + localItem.quantity })
            .eq('id', dbItem.id)
        } else {
          // Insert new item
          await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              product_id: localItem.product_id,
              quantity: localItem.quantity,
            })
        }
      }

      // Clear local cart
      localStorage.removeItem('local_cart')
      
      // Reload cart from database
      await get().fetchCart()
    } catch (error) {
      console.error('Error syncing local cart:', error)
    }
  },

  addToCart: async (productId: string, quantity = 1) => {
    const { user } = useAuthStore.getState()

    try {
      // First, check stock availability
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, stock, is_active')
        .eq('id', productId)
        .single()

      if (productError) throw productError

      if (!product.is_active) {
        useToastStore.getState().show('Este producto no está disponible', 'error')
        throw new Error('Product is not active')
      }

      // Check if item already exists in cart
      const existingItem = get().items.find(
        (item) => item.product_id === productId
      )

      const totalQuantity = existingItem ? existingItem.quantity + quantity : quantity

      if (product.stock < totalQuantity) {
        const available = product.stock - (existingItem?.quantity || 0)
        if (available <= 0) {
          useToastStore.getState().show(
            `No hay stock disponible para "${product.name}"`,
            'error'
          )
          throw new Error('Insufficient stock')
        } else {
          useToastStore.getState().show(
            `Solo hay ${available} unidades disponibles de "${product.name}"`,
            'error'
          )
          throw new Error('Insufficient stock')
        }
      }

      if (existingItem) {
        await get().updateQuantity(existingItem.id, existingItem.quantity + quantity)
        // Show toast notification
        useToastStore.getState().show(
          `Cantidad actualizada en el carrito`,
          'success'
        )
        return
      }

      if (user) {
        // User is logged in - save to database
        const { data, error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity,
          })
          .select(`
            *,
            product:products(*)
          `)
          .single()

        if (error) throw error

        const newItem = {
          ...data,
          product: (data as any).product,
        } as CartItemWithProduct

        set({
          items: [
            ...get().items,
            newItem,
          ],
        })

        // Show toast notification
        useToastStore.getState().show(
          `${newItem.product.name} agregado al carrito`,
          'success'
        )
      } else {
        // User is not logged in - save to localStorage
        const { data: product, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('is_active', true)
          .single()

        if (error) throw error

        // Get current local cart
        const localCart = localStorage.getItem('local_cart')
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []

        // Add or update item
        const existingLocalItem = localItems.find(item => item.product_id === productId)
        if (existingLocalItem) {
          existingLocalItem.quantity += quantity
        } else {
          localItems.push({ product_id: productId, quantity })
        }

        // Save to localStorage
        localStorage.setItem('local_cart', JSON.stringify(localItems))

        // Update state
        const newItem: CartItemWithProduct = {
          id: `local_${productId}`,
          user_id: '',
          product_id: productId,
          quantity: existingLocalItem ? existingLocalItem.quantity : quantity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          product: product as Product,
        }

        set({
          items: [
            ...get().items,
            newItem,
          ],
        })

        // Show toast notification
        useToastStore.getState().show(
          `${product.name} agregado al carrito`,
          'success'
        )
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
      useToastStore.getState().show(
        'Error al agregar producto al carrito',
        'error'
      )
      throw error
    }
  },

  updateQuantity: async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await get().removeFromCart(itemId)
      return
    }

    try {
      const { user } = useAuthStore.getState()
      
      if (user && !itemId.startsWith('local_')) {
        // Update in database
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity })
          .eq('id', itemId)

        if (error) throw error
      } else {
        // Update in localStorage
        const item = get().items.find(i => i.id === itemId)
        if (!item) return

        const localCart = localStorage.getItem('local_cart')
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []
        
        const localItem = localItems.find(li => li.product_id === item.product_id)
        if (localItem) {
          localItem.quantity = quantity
          localStorage.setItem('local_cart', JSON.stringify(localItems))
        }
      }

      set({
        items: get().items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      })
    } catch (error) {
      console.error('Error updating quantity:', error)
      throw error
    }
  },

  removeFromCart: async (itemId: string) => {
    try {
      const { user } = useAuthStore.getState()
      const item = get().items.find(i => i.id === itemId)
      
      if (user && !itemId.startsWith('local_')) {
        // Remove from database
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId)

        if (error) throw error
      } else if (item) {
        // Remove from localStorage
        const localCart = localStorage.getItem('local_cart')
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []
        
        const filteredItems = localItems.filter(li => li.product_id !== item.product_id)
        localStorage.setItem('local_cart', JSON.stringify(filteredItems))
      }

      set({
        items: get().items.filter((item) => item.id !== itemId),
      })
    } catch (error) {
      console.error('Error removing from cart:', error)
      throw error
    }
  },

  clearCart: async () => {
    const { user } = useAuthStore.getState()

    try {
      if (user) {
        // Clear from database
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        // Clear from localStorage
        localStorage.removeItem('local_cart')
      }

      set({ items: [] })
    } catch (error) {
      console.error('Error clearing cart:', error)
      throw error
    }
  },

  getTotal: () => {
    return get().items.reduce((total, item) => {
      return total + item.product.price * item.quantity
    }, 0)
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0)
  },
}))
