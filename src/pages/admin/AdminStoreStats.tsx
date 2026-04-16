import { useEffect, useState } from 'react'
import { useOrganizationStore } from '@/store/organizationStore'
import { supabase } from '@/lib/supabase'
import { BarChart3, Users, Eye, FileText, Monitor, Smartphone, Tablet, RefreshCw } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

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
          {/* Legend */}
          <div className="flex items-center gap-5 mb-4">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#8F5F2C' }} />
              Visitas
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Únicos
            </span>
          </div>

          {loading ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Cargando…</div>
          ) : !data?.time_series?.length ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Sin datos para este período</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.time_series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8F5F2C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8F5F2C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #e5d1bc',
                      fontSize: '12px',
                      boxShadow: '0 4px 16px rgba(143,95,44,0.10)',
                      background: '#fff',
                    }}
                    labelStyle={{ fontWeight: 600, color: '#374151', marginBottom: '4px', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#6b7280' }}
                    cursor={{ stroke: '#d4b596', strokeWidth: 1, strokeDasharray: '4 2' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Visitas"
                    stroke="#8F5F2C"
                    strokeWidth={2}
                    fill="url(#gradViews)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#8F5F2C', strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    name="Únicos"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gradVisitors)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
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
                {data.top_pages.map((p) => {
                  const href = `${window.location.origin}/${currentOrganization?.slug}${p.page_path || '/'}`
                  return (
                    <li key={p.page_path} className="flex items-center gap-2 min-w-0">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-admin-600 hover:text-admin-800 hover:underline truncate flex-1 transition-colors"
                        title={href}
                      >
                        {p.page_path || '/'}
                      </a>
                      <span className="text-sm font-medium text-gray-900 shrink-0">{p.views}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
