import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'
import { queryKeys } from '@/lib/queryKeys'

export interface LowStockProduct {
  name: string
}

export function useLowStockProducts(limit = 5) {
  const { organizationId } = useOrganization()

  const { data = [], isPending: loading } = useQuery({
    queryKey: queryKeys.dashboard.lowStock(organizationId!),
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('products')
        .select('name')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .or('stock.lte(min_stock),stock.lte(low_stock_threshold)')
        .order('stock', { ascending: true })
        .limit(limit)
      return (rows as LowStockProduct[]) ?? []
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  return { data, loading }
}
