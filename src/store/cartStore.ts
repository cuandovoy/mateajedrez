import { capitalizeFirst, getEffectivePrice } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getProductStock } from '@/lib/stock'
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

function localCartKey(organizationId?: string | null) {
  return organizationId ? `local_cart_${organizationId}` : 'local_cart'
}

interface CartState {
  items: CartItemWithProduct[]
  loading: boolean
  fetchCart: (organizationId?: string) => Promise<void>
  addToCart: (productId: string, quantity?: number, variantId?: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeFromCart: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  getTotal: () => number
  getItemCount: () => number
  syncLocalCart: () => Promise<void>
  loadLocalCart: (organizationId?: string) => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  loading: false,

  fetchCart: async (orgIdParam?: string) => {
    const { user } = useAuthStore.getState()
    const organizationId = orgIdParam ?? useOrganizationStore.getState().currentOrganization?.id

    // Clear stale items immediately so we don't flash items from a different org
    set({ loading: true, items: [] })
    try {
      if (user && organizationId) {
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
        await get().loadLocalCart(organizationId)
      }
    } catch (error) {
      console.error('Error fetching cart:', error)
    } finally {
      set({ loading: false })
    }
  },

  loadLocalCart: async (organizationId?: string) => {
    const cartKey = localCartKey(organizationId)
    try {
      const localCart = localStorage.getItem(cartKey)
      if (!localCart) {
        set({ items: [] })
        return
      }

      const localItems: LocalCartItem[] = JSON.parse(localCart)

      const productIds = localItems.map(item => item.product_id)
      if (productIds.length === 0) {
        set({ items: [] })
        return
      }

      let query = supabase
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

      // Filter by org to prevent cross-org contamination
      if (organizationId) {
        query = (query as any).eq('organization_id', organizationId)
      }

      const { data: products, error }: { data: (Product & { product_images?: any[] })[] | null, error: PostgrestError | null } = await query

      if (error) throw error

      const variantIds = localItems.filter(item => item.variant_id).map(item => item.variant_id as string)
      let variants: ProductVariant[] = []
      if (variantIds.length > 0) {
        const { data: variantsData } = await supabase
          .from('product_variants')
          .select('*')
          .in('id', variantIds)

        variants = (variantsData || []) as ProductVariant[]
      }

      const items: CartItemWithProduct[] = localItems
        .map(localItem => {
          const product = products?.find(p => p.id === localItem.product_id)
          if (!product) return null

          const variant = localItem.variant_id
            ? variants.find(v => v.id === localItem.variant_id)
            : null

          return {
            id: `local_${localItem.product_id}_${localItem.variant_id || 'default'}`,
            organization_id: organizationId || '',
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

    const orgCartKey = localCartKey(organizationId)
    // Support legacy key for users who had a cart before org-keying was introduced
    const legacyCartKey = 'local_cart'
    const rawCart = localStorage.getItem(orgCartKey) || localStorage.getItem(legacyCartKey)
    if (!rawCart) return

    try {
      const localItems: LocalCartItem[] = JSON.parse(rawCart)

      for (const localItem of localItems) {
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
          await (supabase
            .from('cart_items') as any)
            .update({ quantity: (dbItem?.quantity || 0) + localItem.quantity })
            .eq('id', dbItem?.id as string)
        } else {
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

      localStorage.removeItem(orgCartKey)
      localStorage.removeItem(legacyCartKey)

      await get().fetchCart()
    } catch (error) {
      console.error('Error syncing local cart:', error)
    }
  },

  addToCart: async (productId: string, quantity = 1, variantId?: string) => {
    const { user } = useAuthStore.getState()

    try {
      let availableStock = 0
      let productName = ''

      if (variantId) {
        const { data: variant, error: variantError } = await (supabase
          .from('product_variants') as any)
          .select('id, name, is_active, product:products(id, name, is_active, organization_id)')
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

        availableStock = await getProductStock(productId, variantId, null, product.organization_id || null)
        productName = variant.name || product.name
      } else {
        const { data: product, error: productError }: { data: Product | null, error: PostgrestError | null } = await supabase
          .from('products')
          .select('id, name, is_active, organization_id')
          .eq('id', productId)
          .single()

        if (productError) throw productError

        if (!product?.is_active) {
          useToastStore.getState().show('Este producto no está disponible', 'error')
          throw new Error('Product is not active')
        }

        const { count: variantsCount } = await supabase
          .from('product_variants')
          .select('id', { head: true, count: 'exact' })
          .eq('product_id', productId)
          .eq('is_active', true)

        if ((variantsCount || 0) > 0) {
          useToastStore.getState().show('Este producto tiene variantes. Selecciona una variante para agregar al carrito.', 'error')
          throw new Error('Variant selection required')
        }

        availableStock = await getProductStock(productId, null, null, product.organization_id || null)
        productName = product.name
      }

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

        useToastStore.getState().show(
          `${capitalizeFirst(newItem.product.name)} agregado al carrito`,
          'success'
        )
      } else {
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

        let variant: ProductVariant | null = null
        if (variantId) {
          const { data: variantData } = await supabase
            .from('product_variants')
            .select('*')
            .eq('id', variantId)
            .single()

          variant = variantData as ProductVariant | null
        }

        // Use org-specific key so carts from different orgs don't mix
        const productOrgId = (product as Product).organization_id || undefined
        const cartKey = localCartKey(productOrgId)
        const localCart = localStorage.getItem(cartKey)
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []

        const existingLocalItem = localItems.find(
          item => item.product_id === productId && item.variant_id === (variantId || null)
        )
        if (existingLocalItem) {
          existingLocalItem.quantity += quantity
        } else {
          localItems.push({ product_id: productId, variant_id: variantId || null, quantity })
        }

        localStorage.setItem(cartKey, JSON.stringify(localItems))

        const newItem: CartItemWithProduct = {
          id: `local_${productId}_${variantId || 'default'}`,
          organization_id: productOrgId || '',
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
        const { error } = await (supabase
          .from('cart_items') as any)
          .update({ quantity })
          .eq('id', itemId)

        if (error) throw error
      } else {
        const item = get().items.find(i => i.id === itemId)
        if (!item) return

        const cartKey = localCartKey(item.organization_id || undefined)
        const localCart = localStorage.getItem(cartKey)
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []

        const localItem = localItems.find(li => li.product_id === item.product_id)
        if (localItem) {
          localItem.quantity = quantity
          localStorage.setItem(cartKey, JSON.stringify(localItems))
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
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId)

        if (error) throw error
      } else if (item) {
        const cartKey = localCartKey(item.organization_id || undefined)
        const localCart = localStorage.getItem(cartKey)
        const localItems: LocalCartItem[] = localCart ? JSON.parse(localCart) : []

        const filteredItems = localItems.filter(li => li.product_id !== item.product_id)
        localStorage.setItem(cartKey, JSON.stringify(filteredItems))
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
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        // Clear all org-specific keys present in current items
        const orgIds = [...new Set(get().items.map(i => i.organization_id).filter(Boolean))]
        for (const orgId of orgIds) {
          localStorage.removeItem(localCartKey(orgId))
        }
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
      const price = item.variant?.price ?? getEffectivePrice(item.product)
      return total + price * item.quantity
    }, 0)
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0)
  },
}))
