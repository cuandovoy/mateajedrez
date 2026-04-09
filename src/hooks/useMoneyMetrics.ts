import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildDateRange } from '@/lib/dateUtils'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'

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
  const [data, setData] = useState<MoneyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!organizationId) return

    let cancelled = false

    const fetch = async () => {
      try {
        const tz = (settings.timezone as string | undefined) ?? 'America/Montevideo'
        const { monthStart, prevMonthStart, prevMonthEnd } = buildDateRange(tz)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: result, error: rpcError } = await (supabase.rpc as any)(
          'get_dashboard_money_metrics',
          {
            p_organization_id: organizationId,
            p_month_start:     monthStart,
            p_prev_start:      prevMonthStart,
            p_prev_end:        prevMonthEnd,
          },
        )

        if (rpcError) throw rpcError
        if (cancelled) return

        setData({
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
        })
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error('Error al cargar métricas financieras'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [organizationId])

  return { data, loading, error }
}
