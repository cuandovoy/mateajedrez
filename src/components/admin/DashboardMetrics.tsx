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
  prevMonthTodayRevenue: number // yesterday's revenue
  prevMonthAverageOrderValue: number
}

interface DailyPoint {
  date: string // YYYY-MM-DD
  revenue: number
  orders: number
}


function MiniBarChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) return null
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-1 h-20">
        {data.map((d) => {
          const heightPct = (d.revenue / maxRevenue) * 100
          const isToday = d.date === new Date().toISOString().split('T')[0]
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
    prevMonthTodayRevenue: 0,
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
      const todayStr = now.toISOString().split('T')[0]

      // Yesterday
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // This month range
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      // Previous month range (same day span to be fair)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0]
      const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0]

      // Last 14 days for chart
      const fourteenDaysAgo = new Date(now)
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
      const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0]

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
          .gte('created_at', `${monthStartStr}T00:00:00`),
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
          .gte('created_at', `${todayStr}T00:00:00`),
        // Yesterday's revenue (for day delta)
        supabase
          .from('orders')
          .select('total')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', `${yesterdayStr}T00:00:00`)
          .lt('created_at', `${todayStr}T00:00:00`),
        // Previous month same period
        supabase
          .from('orders')
          .select('total, status')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', `${prevMonthStartStr}T00:00:00`)
          .lte('created_at', `${prevMonthEndStr}T23:59:59`),
        // Last 14 days for chart
        supabase
          .from('orders')
          .select('total, created_at')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', `${fourteenDaysAgoStr}T00:00:00`)
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

      // Previous month
      const prevMonthRevenue = (prevMonthOrdersResult.data as Array<{ total: number }> | null)?.reduce((sum, o) => sum + o.total, 0) || 0
      const prevMonthOrders = (prevMonthOrdersResult.data as Array<{ total: number }> | null)?.length || 0
      const prevMonthTodayRevenue = (yesterdayOrdersResult.data as Array<{ total: number }> | null)?.reduce((sum, o) => sum + o.total, 0) || 0
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
        prevMonthTodayRevenue,
        prevMonthAverageOrderValue,
      })

      // Build daily chart data
      const dayMap = new Map<string, DailyPoint>()
      for (let i = 0; i < 14; i++) {
        const d = new Date(fourteenDaysAgo)
        d.setDate(d.getDate() + i)
        const key = d.toISOString().split('T')[0]
        dayMap.set(key, { date: key, revenue: 0, orders: 0 })
      }
      ;(recentOrdersResult.data || []).forEach((o: { total: number; created_at: string | null }) => {
        if (!o.created_at) return
        const key = o.created_at.split('T')[0]
        const pt = dayMap.get(key)
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
      description: 'Ventas del día',
      deltaCurrentValue: metrics.todayRevenue,
      deltaPrevValue: metrics.prevMonthTodayRevenue,
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
          <MiniBarChart data={dailyData} />
        </CardContent>
      </Card>
    </div>
  )
}
