import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import { queryKeys } from '@/lib/queryKeys'
import type { OrganizationPaymentMethod } from '@/types/database.types'

type UseOrgPaymentMethodsOptions = {
  includeInactive?: boolean
}

export function useOrgPaymentMethods(
  organizationId?: string | null,
  options?: UseOrgPaymentMethodsOptions
): {
  methods: OrganizationPaymentMethod[]
  loading: boolean
  refetch: () => Promise<void>
} {
  const { includeInactive = false } = options ?? {}
  const currentOrgId = useOrganizationStore((s) => s.currentOrganization?.id)
  const orgId = organizationId ?? currentOrgId
  const queryClient = useQueryClient()

  const { data: methods = [], isPending: loading } = useQuery({
    queryKey: queryKeys.config.paymentMethods(orgId!, includeInactive),
    queryFn: async () => {
      let query = supabase
        .from('organization_payment_methods')
        .select('*')
        .eq('organization_id', orgId!)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (!includeInactive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as OrganizationPaymentMethod[]
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })

  const refetch = () => queryClient.invalidateQueries({
    queryKey: queryKeys.config.paymentMethods(orgId!, includeInactive),
  })

  return { methods, loading, refetch }
}
