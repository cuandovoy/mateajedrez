import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buildDateRange } from '@/lib/dateUtils'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { queryKeys } from '@/lib/queryKeys'

export interface WeeklyPoint {
  week: number
  current: number
  prev: number
}

export interface TopProduct {
  name: string
  revenue: number
}

export interface TrendsMetrics {
  weekly: WeeklyPoint[]
  topProducts: TopProduct[]
}

export function useTrendsMetrics() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const tz = (settings.timezone as string | undefined) ?? 'America/Montevideo'
  const dateRange = buildDateRange(tz)

  const { data, isPending: loading, error } = useQuery({
    queryKey: queryKeys.dashboard.trends(organizationId!, { ...dateRange, tz }),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error: rpcError } = await (supabase.rpc as any)(
        'get_dashboard_trends',
        {
          p_organization_id: organizationId,
          p_month_start:     dateRange.monthStart,
          p_prev_start:      dateRange.prevMonthStart,
          p_prev_end:        dateRange.prevMonthEnd,
          p_timezone:        tz,
        },
      )
      if (rpcError) throw rpcError
      return {
        weekly: (result.weekly ?? []).map((w: { week: number; current: number; prev: number }) => ({
          week: w.week,
          current: Number(w.current),
          prev: Number(w.prev),
        })),
        topProducts: (result.top_products ?? []).map((p: { name: string; revenue: number }) => ({
          name: p.name,
          revenue: Number(p.revenue),
        })),
      } as TrendsMetrics
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })

  return { data: data ?? null, loading, error: error as Error | null }
}
