import { supabase } from '@/lib/supabase'
import type { CartItem, CartItemWithProduct, Product, ProductVariant } from '@/types'
import { PostgrestError } from '@supabase/supabase-js'
import { create } from 'zustand'
import { useAuthStore } from './authStore'
import { useOrganizationStore } from './organizationStore'
import { useToastStore } from './toastStore'

interface LocalCartItem {
  product_id: string
  variant_id?: string | null
  quantity: number
}

interface CartState {
  items: CartItemWithProduct[]
  loading: boolean
  fetchCart: () => Promise<void>
  addToCart: (productId: string, quantity?: number, variantId?: string) => Promise<void>
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
    const organizationId = useOrganizationStore.getState().currentOrganization?.id
    
    set({ loading: true })
    try {
      if (user && organizationId) {
        // Fetch from database with variant information and product images
        const { data, error } = await supabase
          .from('cart_items')
          .select(`
            *,
            product:products(
              *,
              product_images (
                id,
                image_url,
                display_order,
                is_primary
              )
            ),
            variant:product_variants(*)
          `)
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)

        if (error) throw error

        set({
          items: (data || []).map((item: CartItem & { product: Product; variant?: ProductVariant | null }) => ({
            ...item,
            product: item.product,
            variant: item.variant || null,
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

        const { data: products, error }: { data: (Product & { product_images?: any[] })[] | null, error: PostgrestError | null } = await supabase
          .from('products')
          .select(`
          *,
          product_images (
            id,
            image_url,
            display_order,
            is_primary
          )
        `)
          .in('id', productIds)
          .eq('is_active', true)

      if (error) throw error

      // Fetch variants if any
      const variantIds = localItems.filter(item => item.variant_id).map(item => item.variant_id as string)
      let variants: ProductVariant[] = []
      if (variantIds.length > 0) {
        const { data: variantsData } = await supabase
          .from('product_variants')
          .select('*')
          .in('id', variantIds)
        
        variants = (variantsData || []) as ProductVariant[]
      }

      // Map local items with product and variant data
      const items: CartItemWithProduct[] = localItems
        .map(localItem => {
          const product = products?.find(p => p.id === localItem.product_id)
          if (!product) return null

          const variant = localItem.variant_id 
            ? variants.find(v => v.id === localItem.variant_id)
            : null

          return {
            id: `local_${localItem.product_id}_${localItem.variant_id || 'default'}`,
            organization_id: '',
            user_id: '',
            product_id: localItem.product_id,
            variant_id: localItem.variant_id || null,
            quantity: localItem.quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            product: product as Product,
            variant: variant || null,
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
    const organizationId = useOrganizationStore.getState().currentOrganization?.id
    if (!user || !organizationId) return

    const localCart = localStorage.getItem('local_cart')
    if (!localCart) return

    try {
      const localItems: LocalCartItem[] = JSON.parse(localCart)
      
      // Sync each item to database
      for (const localItem of localItems) {
        // Check if item exists in database (matching product_id and variant_id)
        let query = supabase
          .from('cart_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .eq('product_id', localItem.product_id)
        
        if (localItem.variant_id) {
          query = query.eq('variant_id', localItem.variant_id)
        } else {
          query = query.is('variant_id', null)
        }
        
        const { data: dbItem }: { data: CartItem | null; error: PostgrestError | null } = await query.maybeSingle()

        if (dbItem) {
          // Update quantity
          await (supabase
            .from('cart_items') as any)
            .update({ quantity: (dbItem?.quantity || 0) + localItem.quantity })
            .eq('id', dbItem?.id as string)
        } else {
          // Insert new item
          await (supabase
            .from('cart_items') as any)
            .insert({
              organization_id: organizationId,
              user_id: user.id,
              product_id: localItem.product_id,
              variant_id: localItem.variant_id || null,
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

  addToCart: async (productId: string, quantity = 1, variantId?: string) => {
    const { user } = useAuthStore.getState()

    try {
      // Check stock availability - use variant if provided, otherwise product
      let availableStock = 0
      let productName = ''

      if (variantId) {
        // Check variant stock
        const { data: variant, error: variantError } = await (supabase
          .from('product_variants') as any)
          .select('id, name, stock, is_active, product:products(id, name, is_active)')
          .eq('id', variantId)
          .single()

        if (variantError) throw variantError

        if (!variant) {
          useToastStore.getState().show('Variante no encontrada', 'error')
          throw new Error('Variant not found')
        }

        const product = (variant as any).product as Product
        if (!product?.is_active || !variant.is_active) {
          useToastStore.getState().show('Este producto no está disponible', 'error')
          throw new Error('Product or variant is not active')
        }

        availableStock = variant.stock
        productName = variant.name || product.name
      } else {
        // Check product stock (backward compatibility)
        const { data: product, error: productError }: { data: Product | null, error: PostgrestError | null } = await supabase
          .from('products')
          .select('id, name, stock, is_active')
          .eq('id', productId)
          .single()

        if (productError) throw productError

        if (!product?.is_active) {
          useToastStore.getState().show('Este producto no está disponible', 'error')
          throw new Error('Product is not active')
        }

        availableStock = product.stock
        productName = product.name
      }

      // Check if item already exists in cart (matching product_id and variant_id)
      const existingItem = get().items.find(
        (item) => item.product_id === productId && item.variant_id === (variantId || null)
      )

      const totalQuantity = existingItem ? existingItem.quantity + quantity : quantity

      if (availableStock < totalQuantity) {
        const available = availableStock - (existingItem?.quantity || 0)
        if (available <= 0) {
          useToastStore.getState().show(
            `No hay stock disponible para "${productName}"`,
            'error'
          )
          throw new Error('Insufficient stock')
        } else {
          useToastStore.getState().show(
            `Solo hay ${available} unidades disponibles de "${productName}"`,
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
        const organizationId = useOrganizationStore.getState().currentOrganization?.id
        if (!organizationId) {
          useToastStore.getState().show('Selecciona una organización para agregar al carrito', 'error')
          return
        }
        // User is logged in - save to database
        const { data, error } = await (supabase
          .from('cart_items') as any)
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            product_id: productId,
            variant_id: variantId || null,
            quantity,
          })
          .select(`
            *,
            product:products(
              *,
              product_images (
                id,
                image_url,
                display_order,
                is_primary
              )
            ),
            variant:product_variants(*)
          `)
          .single()

        if (error) throw error

        const newItem = {
          ...(data as CartItem),
          product: (data as Product & { product: Product }).product,
          variant: (data as ProductVariant & { variant?: ProductVariant | null })?.variant || null,
        } as CartItem & { product: Product; variant?: ProductVariant | null }

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
          .select(`
            *,
            product_images (
              id,
              image_url,
              display_order,
              is_primary
            )
          `)
          .eq('id', productId)
          .eq('is_active', true)
          .single()

        if (error) throw error

        // Fetch variant if provided
        let variant: ProductVariant | null = null
        if (variantId) {
          const { data: variantData } = await supabase
            .from('product_variants')
            .select('*')
            .eq('id', variantId)
            .single()
          
          variant = variantData as ProductVariant | null
        }

        // Get current local cart
        const localCart = localStorage.getItem('local_cart')
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []

        // Add or update item (matching product_id and variant_id)
        const existingLocalItem = localItems.find(
          item => item.product_id === productId && item.variant_id === (variantId || null)
        )
        if (existingLocalItem) {
          existingLocalItem.quantity += quantity
        } else {
          localItems.push({ product_id: productId, variant_id: variantId || null, quantity })
        }

        // Save to localStorage
        localStorage.setItem('local_cart', JSON.stringify(localItems))

        // Update state
        const newItem: CartItemWithProduct = {
          id: `local_${productId}_${variantId || 'default'}`,
          organization_id: '', // Local cart - set on sync
          user_id: '',
          product_id: productId,
          variant_id: variantId || null,
          quantity: existingLocalItem ? existingLocalItem.quantity : quantity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          product: product as Product,
          variant: variant,
        }

        set({
          items: [
            ...get().items,
            newItem,
          ],
        })

        // Show toast notification
        useToastStore.getState().show(
          `${(product as Product).name} agregado al carrito`,
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
        const { error } = await (supabase
          .from('cart_items') as any)
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
      // Use variant price if available, otherwise product price
      const price = item.variant?.price ?? item.product.price
      return total + price * item.quantity
    }, 0)
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0)
  },
}))
