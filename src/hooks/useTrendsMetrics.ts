import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildDateRange } from '@/lib/dateUtils'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'

export interface WeeklyPoint {
  week: number   // 1–4
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
  const [data, setData] = useState<TrendsMetrics | null>(null)
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
          'get_dashboard_trends',
          {
            p_organization_id: organizationId,
            p_month_start:     monthStart,
            p_prev_start:      prevMonthStart,
            p_prev_end:        prevMonthEnd,
            p_timezone:        tz,
          },
        )

        if (rpcError) throw rpcError
        if (cancelled) return

        setData({
          weekly: (result.weekly ?? []).map((w: { week: number; current: number; prev: number }) => ({
            week: w.week,
            current: Number(w.current),
            prev: Number(w.prev),
          })),
          topProducts: (result.top_products ?? []).map((p: { name: string; revenue: number }) => ({
            name: p.name,
            revenue: Number(p.revenue),
          })),
        })
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error('Error al cargar tendencias'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [organizationId])

  return { data, loading, error }
}
