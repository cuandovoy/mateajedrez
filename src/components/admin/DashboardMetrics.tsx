// Convierte una fecha al string YYYY-MM-DD en la timezone de la organización
const toOrgDateKey = (date: Date, tz: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

// Retorna el offset UTC de la timezone de la org como "+HH:MM" / "-HH:MM" para Supabase
const orgTzOffset = (date: Date, tz: string): string => {
  // Usa Intl para obtener el offset real incluyendo DST
  const utcMs = date.getTime()
  const localMs = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(date).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6')
  ).getTime()
  const diffMin = Math.round((localMs - utcMs) / 60000)
  const sign = diffMin >= 0 ? '+' : '-'
  const abs = Math.abs(diffMin)
  const h = String(Math.floor(abs / 60)).padStart(2, '0')
  const m = String(abs % 60).padStart(2, '0')
  return `${sign}${h}:${m}`
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/Card'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  Star,
  TrendingDown,
  ArrowRight,
} from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatPrice } from '@/lib/utils'

interface Metrics {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalUsers: number
  lowStockProducts: number
  pendingOrders: number
  todayRevenue: number
  averageOrderValue: number
  // Previous-period equivalents for delta
  prevMonthRevenue: number
  prevMonthOrders: number
  yesterdayRevenue: number
  prevMonthAverageOrderValue: number
}

interface DailyPoint {
  date: string // YYYY-MM-DD
  revenue: number
  orders: number
}


function MiniBarChart({ data, timezone }: { data: DailyPoint[]; timezone: string }) {
  if (data.length === 0) return null
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-1 h-20">
        {data.map((d) => {
          const heightPct = (d.revenue / maxRevenue) * 100
          const isToday = d.date === toOrgDateKey(new Date(), timezone)
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-0.5 group relative"
              title={`${d.date}: ${d.revenue.toLocaleString('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 })}`}
            >
              <div
                className={`w-full rounded-sm transition-all ${isToday ? 'bg-admin-600' : 'bg-admin-300 group-hover:bg-admin-500'}`}
                style={{ height: `${Math.max(heightPct, 3)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{data[0]?.date?.slice(5)}</span>
        <span className="text-admin-600 font-medium">Hoy</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

export function DashboardMetrics() {
  const navigate = useNavigate()
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const [metrics, setMetrics] = useState<Metrics>({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    lowStockProducts: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    averageOrderValue: 0,
    prevMonthRevenue: 0,
    prevMonthOrders: 0,
    yesterdayRevenue: 0,
    prevMonthAverageOrderValue: 0,
  })
  const [dailyData, setDailyData] = useState<DailyPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organizationId) fetchMetrics()
  }, [organizationId])

  const fetchMetrics = async () => {
    if (!organizationId) return
    try {
      const now = new Date()
      const tz = (settings.timezone as string | undefined) ?? 'America/Montevideo'
      const tzOffset = orgTzOffset(now, tz)

      // Fechas en la timezone de la org (no UTC, no browser)
      const todayStr = toOrgDateKey(now, tz)

      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = toOrgDateKey(yesterday, tz)

      // Primer día del mes actual en la tz de la org
      // Tomamos el año/mes del "hoy" en la org timezone
      const [todayYear, todayMonth] = todayStr.split('-').map(Number)
      const monthStartStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-01`

      // Mes anterior — mismo span de días, sin overflow de mes corto
      const todayDay = parseInt(todayStr.split('-')[2])
      const prevMonthDate = new Date(now)
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
      const lastDayOfPrevMonth = new Date(todayYear, todayMonth - 1, 0).getDate()
      const prevMonthDay = Math.min(todayDay, lastDayOfPrevMonth)
      const prevMonthYear = todayMonth === 1 ? todayYear - 1 : todayYear
      const prevMonthNum = todayMonth === 1 ? 12 : todayMonth - 1
      const prevMonthStartStr = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-01`
      const prevMonthEndStr = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-${String(prevMonthDay).padStart(2, '0')}`

      // Últimos 14 días para el gráfico
      const fourteenDaysAgo = new Date(now)
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
      const fourteenDaysAgoStr = toOrgDateKey(fourteenDaysAgo, tz)

      // Supabase almacena en UTC — incluir offset para que el filtro sea exacto
      const startOf = (dateStr: string) => `${dateStr}T00:00:00${tzOffset}`
      const endOf   = (dateStr: string) => `${dateStr}T23:59:59${tzOffset}`

      const [
        ordersResult,
        productsResult,
        customersResult,
        lowStockProductsResult,
        lowStockVariantsResult,
        pendingOrdersResult,
        todayOrdersResult,
        yesterdayOrdersResult,
        prevMonthOrdersResult,
        recentOrdersResult,
      ] = await Promise.all([
        // This month completed orders
        supabase
          .from('orders')
          .select('total, status')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', startOf(monthStartStr)),
        supabase
          .from('products')
          .select('id, stock')
          .eq('organization_id', organizationId)
          .eq('is_active', true),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('products')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .or('stock.lte(min_stock),stock.lte(low_stock_threshold)'),
        supabase
          .from('product_variants')
          .select('id, product_id, products!inner(organization_id)')
          .eq('is_active', true)
          .or('stock.lte(min_stock),stock.lte(low_stock_threshold)')
          .eq('products.organization_id', organizationId),
        supabase
          .from('orders')
          .select('id')
          .eq('organization_id', organizationId)
          .in('status', ['pending', 'pending_allocation']),
        // Today's revenue
        supabase
          .from('orders')
          .select('total')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', startOf(todayStr)),
        // Yesterday's revenue (for "vs ayer" delta)
        supabase
          .from('orders')
          .select('total')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', startOf(yesterdayStr))
          .lte('created_at', endOf(yesterdayStr)),
        // Previous month same period (1st to same day of month)
        supabase
          .from('orders')
          .select('total, status')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', startOf(prevMonthStartStr))
          .lte('created_at', endOf(prevMonthEndStr)),
        // Last 14 days for chart
        supabase
          .from('orders')
          .select('total, created_at')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', startOf(fourteenDaysAgoStr))
          .order('created_at', { ascending: true }),
      ])

      const totalRevenue = (ordersResult.data as Array<{ total: number }> | null)?.reduce((sum, o) => sum + o.total, 0) || 0
      const totalOrders = (ordersResult.data as Array<{ total: number }> | null)?.length || 0
      const totalProducts = (productsResult.data as Array<{ id: string; stock: number }> | null)?.length || 0
      const totalUsers = customersResult.count ?? (customersResult.data as unknown[] | null)?.length ?? 0
      const lowStockProducts =
        ((lowStockProductsResult.data as Array<{ id: string }> | null)?.length ?? 0) +
        ((lowStockVariantsResult.data as Array<{ id: string }> | null)?.length ?? 0)
      const pendingOrders = (pendingOrdersResult.data as Array<{ id: string }> | null)?.length || 0
      const todayRevenue = (todayOrdersResult.data as Array<{ total: number }> | null)?.reduce((sum, o) => sum + o.total, 0) || 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Previous month / yesterday
      const prevMonthRevenue = (prevMonthOrdersResult.data as Array<{ total: number }> | null)?.reduce((sum, o) => sum + o.total, 0) || 0
      const prevMonthOrders = (prevMonthOrdersResult.data as Array<{ total: number }> | null)?.length || 0
      const yesterdayRevenue = (yesterdayOrdersResult.data as Array<{ total: number }> | null)?.reduce((sum, o) => sum + o.total, 0) || 0
      const prevMonthAverageOrderValue = prevMonthOrders > 0 ? prevMonthRevenue / prevMonthOrders : 0

      setMetrics({
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        lowStockProducts,
        pendingOrders,
        todayRevenue,
        averageOrderValue,
        prevMonthRevenue,
        prevMonthOrders,
        yesterdayRevenue,
        prevMonthAverageOrderValue,
      })

      // Build daily chart data — bucket por fecha en tz de la org
      const dayMap = new Map<string, DailyPoint>()
      for (let i = 0; i < 14; i++) {
        const d = new Date(fourteenDaysAgo)
        d.setDate(d.getDate() + i)
        const key = toOrgDateKey(d, tz)
        dayMap.set(key, { date: key, revenue: 0, orders: 0 })
      }
      ;(recentOrdersResult.data || []).forEach((o: { total: number; created_at: string | null }) => {
        if (!o.created_at) return
        // Convertir timestamp UTC a fecha en la tz de la org
        const orgKey = toOrgDateKey(new Date(o.created_at), tz)
        const pt = dayMap.get(orgKey)
        if (pt) {
          pt.revenue += o.total
          pt.orders += 1
        }
      })
      setDailyData(Array.from(dayMap.values()))
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  interface MetricCard {
    title: string
    value: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bgColor: string
    description: string
    deltaCurrentValue?: number
    deltaPrevValue?: number
    onClick?: () => void
    clickable?: boolean
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Ingresos del Mes',
      value: formatPrice(metrics.totalRevenue, settings),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Ventas completadas este mes',
      deltaCurrentValue: metrics.totalRevenue,
      deltaPrevValue: metrics.prevMonthRevenue,
    },
    {
      title: 'Ingresos de Hoy',
      value: formatPrice(metrics.todayRevenue, settings),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'vs ayer',
      deltaCurrentValue: metrics.todayRevenue,
      deltaPrevValue: metrics.yesterdayRevenue,
    },
    {
      title: 'Órdenes del Mes',
      value: metrics.totalOrders.toString(),
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Pedidos completados',
      deltaCurrentValue: metrics.totalOrders,
      deltaPrevValue: metrics.prevMonthOrders,
    },
    {
      title: 'Ticket Promedio',
      value: formatPrice(metrics.averageOrderValue, settings),
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Por orden este mes',
      deltaCurrentValue: metrics.averageOrderValue,
      deltaPrevValue: metrics.prevMonthAverageOrderValue,
    },
    {
      title: 'Productos Activos',
      value: metrics.totalProducts.toString(),
      icon: Package,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'En catálogo',
    },
    {
      title: 'Clientes Registrados',
      value: metrics.totalUsers.toString(),
      icon: Users,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      description: 'Total de clientes',
    },
    {
      title: 'Órdenes Pendientes',
      value: metrics.pendingOrders.toString(),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Requieren atención',
      onClick: () => navigate('/orders?status=pending'),
      clickable: true,
    },
    {
      title: 'Productos Bajo Stock',
      value: metrics.lowStockProducts.toString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Por debajo del umbral mínimo',
      onClick: () => navigate('/inventory'),
      clickable: metrics.lowStockProducts > 0,
    },
  ]

  return (
    <div className="mb-8 space-y-6">
      {/* Actionable alerts (#15) */}
      {(metrics.pendingOrders > 0 || metrics.lowStockProducts > 0) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {metrics.pendingOrders > 0 && (
            <button
              onClick={() => navigate('/orders?status=pending')}
              className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800 hover:bg-orange-100 transition-colors text-left"
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                <strong>{metrics.pendingOrders}</strong>{' '}
                {metrics.pendingOrders === 1 ? 'orden pendiente de cobro' : 'órdenes pendientes de cobro'}
              </span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0" />
            </button>
          )}
          {metrics.lowStockProducts > 0 && (
            <button
              onClick={() => navigate('/inventory')}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 hover:bg-red-100 transition-colors text-left"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{metrics.lowStockProducts}</strong>{' '}
                {metrics.lowStockProducts === 1 ? 'producto con stock bajo el umbral' : 'productos con stock bajo el umbral'}
              </span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Metric cards (#4 with delta %) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon
          const isClickable = metric.clickable
          const handleClick = metric.onClick

          return (
            <Card
              key={index}
              className={`hover:shadow-lg transition-shadow ${isClickable ? 'cursor-pointer' : ''}`}
              onClick={isClickable ? handleClick : undefined}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`${metric.bgColor} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                  {metric.deltaCurrentValue !== undefined && metric.deltaPrevValue !== undefined && metric.deltaPrevValue > 0 && (() => {
                    const pct = Math.round(((metric.deltaCurrentValue - metric.deltaPrevValue) / metric.deltaPrevValue) * 100)
                    if (pct === 0) return null
                    const up = pct > 0
                    const TrendIcon = up ? TrendingUp : TrendingDown
                    return (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <TrendIcon className="h-3 w-3" />
                        {Math.abs(pct)}%
                      </span>
                    )
                  })()}
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.title}</h3>
                <p className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</p>
                <p className="text-xs text-gray-500">{metric.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Mini sales chart last 14 days (#10) */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-700">Ventas — últimos 14 días</h3>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-admin-600 hover:underline flex items-center gap-1"
            >
              Ver órdenes <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <MiniBarChart data={dailyData} timezone={(settings.timezone as string | undefined) ?? 'America/Montevideo'} />
        </CardContent>
      </Card>
    </div>
  )
}
