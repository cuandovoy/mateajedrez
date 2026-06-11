import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  canUseFeature as canUseFeatureLib,
  getPlanLimits,
  type PlanFeature,
} from '@/lib/planLimits'
import { useOrganizationStore } from '@/store/organizationStore'
import { queryKeys } from '@/lib/queryKeys'

interface PlanCounts {
  productCount: number
  branchCount: number
}

export function usePlanLimits(): {
  tier: string
  limits: ReturnType<typeof getPlanLimits>
  canUseFeature: (feature: PlanFeature) => boolean
  isAtLimit: (type: 'products' | 'branches') => boolean
  productCount: number
  branchCount: number
  loading: boolean
  refreshCounts: () => void
} {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization)
  const orgId = currentOrganization?.id ?? null
  const tier = currentOrganization?.subscription_tier ?? 'starter'
  const limits = getPlanLimits(tier)
  const queryClient = useQueryClient()

  const { data, isPending: loading } = useQuery<PlanCounts>({
    queryKey: queryKeys.config.planLimits(orgId!),
    queryFn: async () => {
      const [productsRes, branchesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!),
        supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('is_active', true),
      ])
      return {
        productCount: productsRes.count ?? 0,
        branchCount: branchesRes.count ?? 0,
      }
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })

  const productCount = data?.productCount ?? 0
  const branchCount = data?.branchCount ?? 0

  const canUseFeature = (feature: PlanFeature) => canUseFeatureLib(tier, feature)

  const isAtLimit = (type: 'products' | 'branches'): boolean => {
    if (type === 'products') return productCount >= (limits.products ?? Infinity)
    if (type === 'branches') return branchCount >= (limits.branches ?? Infinity)
    return false
  }

  const refreshCounts = () => {
    if (orgId) queryClient.invalidateQueries({ queryKey: queryKeys.config.planLimits(orgId) })
  }

  return {
    tier,
    limits,
    canUseFeature,
    isAtLimit,
    productCount,
    branchCount,
    loading,
    refreshCounts,
  }
}
