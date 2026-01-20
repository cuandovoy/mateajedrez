import { useEffect, useState } from 'react'
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
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      // Fetch all metrics in parallel for better performance
      const [
        ordersResult,
        productsResult,
        usersResult,
        lowStockResult,
        pendingOrdersResult,
        todayOrdersResult,
      ] = await Promise.all([
        // Total revenue and orders
        supabase
          .from('orders')
          .select('total, status')
          .in('status', ['delivered', 'shipped', 'processing']),
        
        // Total products
        supabase
          .from('products')
          .select('id, stock')
          .eq('is_active', true),
        
        // Total users
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: false }),
        
        // Low stock products (less than 10)
        supabase
          .from('products')
          .select('id')
          .eq('is_active', true)
          .lt('stock', 10),
        
        // Pending orders
        supabase
          .from('orders')
          .select('id')
          .eq('status', 'pending'),
        
        // Today's revenue
        supabase
          .from('orders')
          .select('total')
          .in('status', ['delivered', 'shipped', 'processing'])
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ])

      const totalRevenue = (ordersResult.data as Array<{ total: number }> | null)?.reduce((sum, order) => sum + order.total, 0) || 0
      const totalOrders = (ordersResult.data as Array<{ total: number }> | null)?.length || 0
      const totalProducts = (productsResult.data as Array<{ id: string; stock: number }> | null)?.length || 0
      const totalUsers = usersResult.count || 0
      const lowStockProducts = (lowStockResult.data as Array<{ id: string }> | null)?.length || 0
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

  const metricCards = [
    {
      title: 'Ingresos Totales',
      value: formatPrice(metrics.totalRevenue),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Ventas completadas',
    },
    {
      title: 'Ingresos de Hoy',
      value: formatPrice(metrics.todayRevenue),
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
      value: formatPrice(metrics.averageOrderValue),
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
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
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
