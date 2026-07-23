import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { ProductVariant } from '@/types'

async function fetchProductVariants(organizationId: string, productId: string): Promise<ProductVariant[]> {
  // Join contra products para exigir organization_id — product_variants no tiene esa columna
  // propia, y su RLS pública no filtra por organización (ver .claude/TODO.md).
  const { data, error } = await supabase
    .from('product_variants')
    .select('*, product:products!inner(organization_id)')
    .eq('product_id', productId)
    .eq('is_active', true)
    .eq('product.organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data ?? []) as Array<ProductVariant & { product?: unknown }>).map(({ product: _product, ...variant }) => variant)
}

export function useProductVariants(organizationId: string | null | undefined, productId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.store.productVariants(organizationId ?? '', productId ?? ''),
    queryFn: () => fetchProductVariants(organizationId!, productId!),
    enabled: !!organizationId && !!productId,
    staleTime: 5 * 60 * 1000,
  })
}
