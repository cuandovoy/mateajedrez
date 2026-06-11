import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buildDateRange } from '@/lib/dateUtils'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { queryKeys } from '@/lib/queryKeys'

export interface OperationalMetrics {
  monthOrders: number
  prevMonthOrders: number
  pendingOrders: number
  lowStockCount: number
  newCustomers: number
  prevMonthNewCustomers: number
}

export function useOperationalMetrics() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const tz = (settings.timezone as string | undefined) ?? 'America/Montevideo'
  const dateRange = buildDateRange(tz)

  const { data, isPending: loading, error } = useQuery({
    queryKey: queryKeys.dashboard.operational(organizationId!, { ...dateRange, tz }),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error: rpcError } = await (supabase.rpc as any)(
        'get_dashboard_operational_metrics',
        {
          p_organization_id: organizationId,
          p_month_start:     dateRange.monthStart,
          p_prev_start:      dateRange.prevMonthStart,
          p_prev_end:        dateRange.prevMonthEnd,
        },
      )
      if (rpcError) throw rpcError
      return {
        monthOrders:            result.month_orders,
        prevMonthOrders:        result.prev_month_orders,
        pendingOrders:          result.pending_orders,
        lowStockCount:          result.low_stock_count,
        newCustomers:           result.new_customers,
        prevMonthNewCustomers:  result.prev_month_new_customers,
      } as OperationalMetrics
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })

  return { data: data ?? null, loading, error: error as Error | null }
}
