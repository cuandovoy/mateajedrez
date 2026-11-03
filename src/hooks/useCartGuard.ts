import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { findBlockedCartItems, type BlockedCartItem, type ProductStoreFlags } from '@/lib/cartGuard'
import type { CartItemWithProduct } from '@/types'

export async function fetchProductStoreFlags(organizationId: string, productIds: string[]): Promise<ProductStoreFlags[]> {
  if (productIds.length === 0) return []
  const { data, error } = await supabase
    .from('products')
    .select('id, is_active, visible_in_store, requires_availability_check')
    .eq('organization_id', organizationId)
    .in('id', productIds)
  if (error) throw error
  return (data ?? []) as ProductStoreFlags[]
}

export function toGuardItems(items: CartItemWithProduct[]) {
  return items.map((item) => ({ id: item.id, product_id: item.product_id, name: item.product.name }))
}

/** Fresh (uncached) check of the cart against current product flags. */
export async function checkCartItems(organizationId: string, items: CartItemWithProduct[]): Promise<BlockedCartItem[]> {
  const flags = await fetchProductStoreFlags(organizationId, [...new Set(items.map((i) => i.product_id))])
  return findBlockedCartItems(toGuardItems(items), flags)
}

/** Cart items that can no longer be bought online (hidden, inactive, or "consultar disponibilidad"). */
export function useCartGuard(organizationId: string, items: CartItemWithProduct[]) {
  const productIds = [...new Set(items.map((i) => i.product_id))]
  const query = useQuery({
    queryKey: queryKeys.store.cartGuard(organizationId, productIds),
    queryFn: () => checkCartItems(organizationId, items),
    enabled: !!organizationId && items.length > 0,
    staleTime: 0,
  })
  return { blockedItems: query.data ?? [], loading: query.isLoading }
}
