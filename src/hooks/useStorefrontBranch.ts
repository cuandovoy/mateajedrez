import { useQuery } from '@tanstack/react-query'
import { getStorefrontBranchId } from '@/lib/stock'
import { queryKeys } from '@/lib/queryKeys'

/** Branch that serves the online store, resolved by the SaaS-owned RPC (see getStorefrontBranchId). */
export function useStorefrontBranch(organizationId: string | null | undefined, excludeIsolatedWarehouses = true) {
  const query = useQuery({
    queryKey: queryKeys.store.storefrontBranch(organizationId ?? '', excludeIsolatedWarehouses),
    queryFn: () => getStorefrontBranchId(organizationId, { excludeIsolatedWarehouses }),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })
  return { branchId: query.data ?? null, loading: query.isLoading }
}
