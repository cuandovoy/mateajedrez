import { useEffect, useState } from 'react'
import { useOrganizationStore } from '@/store/organizationStore'
import { supabase } from '@/lib/supabase'
import { BarChart3, Users, Eye, FileText, Monitor, Smartphone, Tablet, RefreshCw } from 'lucide-react'

type Period = 'hour' | 'day' | 'week' | 'month'

interface AnalyticsSummary {
  total_views: number
  unique_visitors: number
  unique_pages: number
}

interface DeviceStat {
  device_type: string
  views: number
  visitors: number
}

interface PageStat {
  page_path: string
  views: number
  visitors: number
}

interface TimePoint {
  bucket: string
  views: number
  visitors: number
}

interface AnalyticsData {
  summary: AnalyticsSummary
  by_device: DeviceStat[]
  top_pages: PageStat[]
  time_series: TimePoint[]
}

const PERIOD_LABELS: Record<Period, string> = {
  hour: 'Última hora',
  day: 'Últimas 24h',
  week: 'Últimos 7 días',
  month: 'Últimos 30 días',
}

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === 'mobile') return <Smartphone className="h-4 w-4 text-gray-500" />
  if (type === 'tablet') return <Tablet className="h-4 w-4 text-gray-500" />
  return <Monitor className="h-4 w-4 text-gray-500" />
}

export function AdminStoreStats() {
  const { currentOrganization } = useOrganizationStore()
  const [period, setPeriod] = useState<Period>('day')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (!currentOrganization?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'get_store_analytics' as any,
        { p_organization_id: currentOrganization.id, p_period: period }
      )
      if (rpcError) throw rpcError
      setData(result as AnalyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentOrganization?.id, period])

  const summary = data?.summary
  const maxViews = data?.time_series.length
    ? Math.max(...data.time_series.map((p) => p.views), 1)
    : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Estadísticas de la tienda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visitas y actividad de tu tienda pública</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white text-sm">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition-colors ${
                  period === p
                    ? 'bg-admin-600 text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-40"
            title="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Visitas totales', value: summary?.total_views ?? 0, icon: Eye, color: 'text-admin-600' },
          { label: 'Visitantes únicos', value: summary?.unique_visitors ?? 0, icon: Users, color: 'text-emerald-600' },
          { label: 'Páginas visitadas', value: summary?.unique_pages ?? 0, icon: FileText, color: 'text-violet-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <span className="inline-block w-10 h-6 bg-gray-100 rounded animate-pulse" /> : value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Time series */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Visitas en el tiempo</h2>
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Cargando…</div>
          ) : !data?.time_series?.length ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sin datos para este período</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Período</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Visitas</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Únicos</th>
                    <th className="w-32 pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.time_series.map((row) => (
                    <tr key={row.bucket}>
                      <td className="py-1.5 text-gray-700 font-mono text-xs">{row.bucket}</td>
                      <td className="py-1.5 text-right text-gray-900 font-medium">{row.views}</td>
                      <td className="py-1.5 text-right text-gray-500">{row.visitors}</td>
                      <td className="py-1.5 pl-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-admin-500 rounded-full"
                            style={{ width: `${Math.round((row.views / maxViews) * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* By device */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Por dispositivo</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : !data?.by_device?.length ? (
              <p className="text-sm text-gray-400">Sin datos</p>
            ) : (
              <ul className="space-y-2">
                {data.by_device.map((d) => (
                  <li key={d.device_type} className="flex items-center gap-2">
                    <DeviceIcon type={d.device_type} />
                    <span className="text-sm text-gray-700 capitalize flex-1">{d.device_type}</span>
                    <span className="text-sm font-medium text-gray-900">{d.views}</span>
                    <span className="text-xs text-gray-400">vis.</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top pages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Páginas más visitadas</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : !data?.top_pages?.length ? (
              <p className="text-sm text-gray-400">Sin datos</p>
            ) : (
              <ul className="space-y-2">
                {data.top_pages.map((p) => (
                  <li key={p.page_path} className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-gray-500 truncate flex-1">
                      {p.page_path || '/'}
                    </span>
                    <span className="text-sm font-medium text-gray-900 shrink-0">{p.views}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
