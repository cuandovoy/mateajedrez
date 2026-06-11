import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import type { Branch } from '@/types'

export function useAdminBranches(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.branches.all(organizationId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as Branch[]
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })
}
