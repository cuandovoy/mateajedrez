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
  Star
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
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organizationId) fetchMetrics()
  }, [organizationId])

  const fetchMetrics = async () => {
    if (!organizationId) return
    try {
      const todayStart = new Date().toISOString().split('T')[0]
      // Todas las métricas filtradas por organización actual
      const [
        ordersResult,
        productsResult,
        customersResult,
        lowStockProductsResult,
        lowStockVariantsResult,
        pendingOrdersResult,
        todayOrdersResult,
      ] = await Promise.all([
        // Ingresos y órdenes completadas (por org)
        supabase
          .from('orders')
          .select('total, status')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing']),
        // Productos activos (por org)
        supabase
          .from('products')
          .select('id, stock')
          .eq('organization_id', organizationId)
          .eq('is_active', true),
        // Clientes de la organización (tabla customers, no user_profiles)
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        // Productos sin variantes con bajo stock (por org)
        supabase
          .from('products')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .or('stock.lte(min_stock),stock.lte(low_stock_threshold)'),
        // Variantes con bajo stock (vía product.organization_id)
        supabase
          .from('product_variants')
          .select('id, product_id, products!inner(organization_id)')
          .eq('is_active', true)
          .or('stock.lte(min_stock),stock.lte(low_stock_threshold)')
          .eq('products.organization_id', organizationId),
        // Órdenes pendientes (por org)
        supabase
          .from('orders')
          .select('id')
          .eq('organization_id', organizationId)
          .in('status', ['pending', 'pending_allocation']),
        // Ingresos de hoy (por org)
        supabase
          .from('orders')
          .select('total')
          .eq('organization_id', organizationId)
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', todayStart),
      ])

      const totalRevenue = (ordersResult.data as Array<{ total: number }> | null)?.reduce((sum, order) => sum + order.total, 0) || 0
      const totalOrders = (ordersResult.data as Array<{ total: number }> | null)?.length || 0
      const totalProducts = (productsResult.data as Array<{ id: string; stock: number }> | null)?.length || 0
      const totalUsers = customersResult.count ?? (customersResult.data as unknown[] | null)?.length ?? 0
      const lowStockProducts =
        ((lowStockProductsResult.data as Array<{ id: string }> | null)?.length ?? 0) +
        ((lowStockVariantsResult.data as Array<{ id: string }> | null)?.length ?? 0)
      const pendingOrders = (pendingOrdersResult.data as Array<{ id: string }> | null)?.length || 0
      const todayRevenue = (todayOrdersResult.data as Array<{ total: number }> | null)?.reduce((sum, order) => sum + order.total, 0) || 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      setMetrics({
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        lowStockProducts,
        pendingOrders,
        todayRevenue,
        averageOrderValue,
      })
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
    onClick?: () => void
    clickable?: boolean
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Ingresos Totales',
      value: formatPrice(metrics.totalRevenue, settings),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Ventas completadas',
    },
    {
      title: 'Ingresos de Hoy',
      value: formatPrice(metrics.todayRevenue, settings),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Ventas del día',
    },
    {
      title: 'Órdenes Totales',
      value: metrics.totalOrders.toString(),
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Pedidos completados',
    },
    {
      title: 'Ticket Promedio',
      value: formatPrice(metrics.averageOrderValue, settings),
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Por orden',
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
      title: 'Usuarios Registrados',
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
      description: 'Menos de 10 unidades',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</p>
              <p className="text-xs text-gray-500">{metric.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
