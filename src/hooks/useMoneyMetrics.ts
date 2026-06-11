import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buildDateRange } from '@/lib/dateUtils'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { queryKeys } from '@/lib/queryKeys'

export interface MoneyMetrics {
  monthRevenue: number
  prevMonthRevenue: number
  totalOrders: number
  prevMonthOrders: number
  averageOrderValue: number
  prevMonthAverageOrderValue: number
  grossMarginAmount: number
  prevMonthGrossMarginAmount: number
  grossMarginPct: number
  prevMonthGrossMarginPct: number
}

export function useMoneyMetrics() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const tz = (settings.timezone as string | undefined) ?? 'America/Montevideo'
  const dateRange = buildDateRange(tz)

  const { data, isPending: loading, error } = useQuery({
    queryKey: queryKeys.dashboard.money(organizationId!, { ...dateRange, tz }),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error: rpcError } = await (supabase.rpc as any)(
        'get_dashboard_money_metrics',
        {
          p_organization_id: organizationId,
          p_month_start:     dateRange.monthStart,
          p_prev_start:      dateRange.prevMonthStart,
          p_prev_end:        dateRange.prevMonthEnd,
        },
      )
      if (rpcError) throw rpcError
      return {
        monthRevenue:                result.month_revenue,
        prevMonthRevenue:            result.prev_month_revenue,
        totalOrders:                 result.month_orders,
        prevMonthOrders:             result.prev_month_orders,
        averageOrderValue:           result.month_avg_order_value,
        prevMonthAverageOrderValue:  result.prev_month_avg_order_value,
        grossMarginAmount:           result.month_gross_margin_amount,
        prevMonthGrossMarginAmount:  result.prev_month_gross_margin_amount,
        grossMarginPct:              result.month_gross_margin_pct,
        prevMonthGrossMarginPct:     result.prev_month_gross_margin_pct,
      } as MoneyMetrics
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })

  return { data: data ?? null, loading, error: error as Error | null }
}
