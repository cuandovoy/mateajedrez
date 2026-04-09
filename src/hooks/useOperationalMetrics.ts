import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildDateRange } from '@/lib/dateUtils'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'

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
  const [data, setData] = useState<OperationalMetrics | null>(null)
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
          'get_dashboard_operational_metrics',
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
          monthOrders:            result.month_orders,
          prevMonthOrders:        result.prev_month_orders,
          pendingOrders:          result.pending_orders,
          lowStockCount:          result.low_stock_count,
          newCustomers:           result.new_customers,
          prevMonthNewCustomers:  result.prev_month_new_customers,
        })
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error('Error al cargar métricas operativas'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [organizationId])

  return { data, loading, error }
}
