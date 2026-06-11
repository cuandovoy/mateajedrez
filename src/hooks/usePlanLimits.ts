import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  canUseFeature as canUseFeatureLib,
  getPlanLimits,
  type PlanFeature,
} from '@/lib/planLimits'
import { useOrganizationStore } from '@/store/organizationStore'

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

  const [productCount, setProductCount] = useState(0)
  const [branchCount, setBranchCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [productsRes, branchesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId),
        supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_active', true),
      ])
      setProductCount(productsRes.count ?? 0)
      setBranchCount(branchesRes.count ?? 0)
    } catch {
      setProductCount(0)
      setBranchCount(0)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (!orgId) {
      setProductCount(0)
      setBranchCount(0)
      setLoading(false)
      return
    }
    fetchCounts()
  }, [orgId, fetchCounts])

  const canUseFeature = (feature: PlanFeature) => canUseFeatureLib(tier, feature)

  const isAtLimit = (type: 'products' | 'branches'): boolean => {
    if (type === 'products') return productCount >= (limits.products ?? Infinity)
    if (type === 'branches') return branchCount >= (limits.branches ?? Infinity)
    return false
  }

  return {
    tier,
    limits,
    canUseFeature,
    isAtLimit,
    productCount,
    branchCount,
    loading,
    refreshCounts: fetchCounts,
  }
}
