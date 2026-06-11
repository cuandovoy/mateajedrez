import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { ProductVariant } from '@/types'

async function fetchProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function useProductVariants(productId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.store.productVariants(productId!),
    queryFn: () => fetchProductVariants(productId!),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  })
}
