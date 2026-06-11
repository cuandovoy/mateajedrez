import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { BillerConfig } from '@/types/biller'

export function useBillerConfig(organizationId: string | null) {
  const queryClient = useQueryClient()

  const { data: config = null, isPending: loading } = useQuery({
    queryKey: queryKeys.config.billerConfig(organizationId!),
    queryFn: async () => {
      const { data } = await supabase
        .from('biller_config' as never)
        .select('*')
        .eq('organization_id', organizationId!)
        .maybeSingle()
      return data ? (data as unknown as BillerConfig) : null
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })

  const refetch = () => queryClient.invalidateQueries({
    queryKey: queryKeys.config.billerConfig(organizationId!),
  })

  return { config, loading, refetch }
}
