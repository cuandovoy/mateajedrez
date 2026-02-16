import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import type { Branch, Order, OrderItem, Product } from '@/types'
import { useOrganization } from '@/hooks/useOrganization'
import {
  ArrowUpRight, BarChart3, Building2, Calendar, DollarSign, Package, ShoppingCart,
  TrendingUp
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface SalesMetrics {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  todayRevenue: number
  todayOrders: number
  weekRevenue: number
  weekOrders: number
  monthRevenue: number
  monthOrders: number
  yearRevenue: number
  yearOrders: number
}

interface TopProduct {
  product_id: string
  product_name: string
  total_quantity: number
  total_revenue: number
}

interface OrderStatusCount {
  status: string
  count: number
  revenue: number
}

interface DailySales {
  date: string
  revenue: number
  orders: number
}

export function AdminSales() {
  const { organizationId } = useOrganization()
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('') // Empty = all branches
  const [metrics, setMetrics] = useState<SalesMetrics>({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    todayRevenue: 0,
    todayOrders: 0,
    weekRevenue: 0,
    weekOrders: 0,
    monthRevenue: 0,
    monthOrders: 0,
    yearRevenue: 0,
    yearOrders: 0,
  })
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [orderStatusCounts, setOrderStatusCounts] = useState<OrderStatusCount[]>([])
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [salesByBranch, setSalesByBranch] = useState<Array<{ branch_id: string; branch_name: string; revenue: number; orders: number }>>([])

  useEffect(() => {
    if (organizationId) fetchBranches()
  }, [organizationId])

  useEffect(() => {
    if (organizationId) fetchSalesData()
  }, [organizationId, selectedPeriod, selectedBranchId])

  const fetchBranches = async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBranches((data || []) as Branch[])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchSalesData = async () => {
    if (!organizationId) return
    try {
      setLoading(true)

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      const yearAgo = new Date(today)
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)

      // Fetch all orders with statuses that count as sales
      // Filter by organization and branch if selected
      let ordersQuery = supabase
        .from('orders')
        .select('id, total, status, created_at, branch_id')
        .eq('organization_id', organizationId)
        .in('status', ['delivered', 'shipped', 'processing', 'pending'])

      if (selectedBranchId) {
        ordersQuery = ordersQuery.eq('branch_id', selectedBranchId)
      }

      const { data: allOrders, error: ordersError } = await ordersQuery

      if (ordersError) throw ordersError

      const orders = allOrders as Order[]

      // Calculate metrics
      const completedOrders = orders.filter((o) =>
        ['delivered', 'shipped', 'processing'].includes(o.status)
      )

      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0)
      const totalOrders = completedOrders.length
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      const todayOrders = completedOrders.filter(
        (o) => new Date(o.created_at) >= today
      )
      const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0)

      const weekOrders = completedOrders.filter(
        (o) => new Date(o.created_at) >= weekAgo
      )
      const weekRevenue = weekOrders.reduce((sum, o) => sum + o.total, 0)

      const monthOrders = completedOrders.filter(
        (o) => new Date(o.created_at) >= monthAgo
      )
      const monthRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0)

      const yearOrders = completedOrders.filter(
        (o) => new Date(o.created_at) >= yearAgo
      )
      const yearRevenue = yearOrders.reduce((sum, o) => sum + o.total, 0)

      setMetrics({
        totalRevenue,
        totalOrders,
        averageOrderValue,
        todayRevenue,
        todayOrders: todayOrders.length,
        weekRevenue,
        weekOrders: weekOrders.length,
        monthRevenue,
        monthOrders: monthOrders.length,
        yearRevenue,
        yearOrders: yearOrders.length,
      })

      // Fetch top products
      const { data: orderItems, error: itemsError }: { data: OrderItem[] | null, error: Error | null } = await supabase
        .from('order_items')
        .select('product_id, quantity, price, order_id')
        .in(
          'order_id',
          completedOrders.map((o) => o.id)
        )

      if (itemsError) throw itemsError

      // Get product names
      const productIds = [...new Set((orderItems || []).map((item) => item.product_id))]
      const { data: products, error: productsError }: { data: Product[] | null, error: Error | null } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)

      if (productsError) throw productsError

      const productMap = new Map((products || []).map((p) => [p.id, p.name]))

      // Calculate top products
      const productStats = new Map<string, { quantity: number; revenue: number }>()
      ;(orderItems || []).forEach((item) => {
        const current = productStats.get(item.product_id) || { quantity: 0, revenue: 0 }
        productStats.set(item.product_id, {
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + item.price * item.quantity,
        })
      })

      const topProductsData: TopProduct[] = Array.from(productStats.entries())
        .map(([product_id, stats]) => ({
          product_id,
          product_name: productMap.get(product_id) || 'Producto desconocido',
          total_quantity: stats.quantity,
          total_revenue: stats.revenue,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10)

      setTopProducts(topProductsData)

      // Calculate order status distribution
      const statusMap = new Map<string, { count: number; revenue: number }>()
      orders.forEach((order) => {
        const current = statusMap.get(order.status) || { count: 0, revenue: 0 }
        statusMap.set(order.status, {
          count: current.count + 1,
          revenue: current.revenue + order.total,
        })
      })

      const statusLabels: Record<string, string> = {
        pending: 'Pendiente',
        processing: 'En Proceso',
        shipped: 'Enviado',
        delivered: 'Entregado',
        cancelled: 'Cancelado',
      }

      const statusCountsData: OrderStatusCount[] = Array.from(statusMap.entries()).map(
        ([status, stats]) => ({
          status: statusLabels[status] || status,
          count: stats.count,
          revenue: stats.revenue,
        })
      )

      setOrderStatusCounts(statusCountsData)

      // Calculate daily sales for chart
      const daysToShow = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - daysToShow)

      const dailyMap = new Map<string, { revenue: number; orders: number }>()
      completedOrders
        .filter((o) => new Date(o.created_at) >= startDate)
        .forEach((order) => {
          const dateKey = new Date(order.created_at).toISOString().split('T')[0]
          const current = dailyMap.get(dateKey) || { revenue: 0, orders: 0 }
          dailyMap.set(dateKey, {
            revenue: current.revenue + order.total,
            orders: current.orders + 1,
          })
        })

      // Fill in missing dates with zero values
      const dailySalesData: DailySales[] = []
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateKey = date.toISOString().split('T')[0]
        const stats = dailyMap.get(dateKey) || { revenue: 0, orders: 0 }
        dailySalesData.push({
          date: dateKey,
          revenue: stats.revenue,
          orders: stats.orders,
        })
      }

      setDailySales(dailySalesData)

      // Calculate sales by branch (if no branch filter is selected)
      if (!selectedBranchId) {
        const branchSalesMap = new Map<string, { revenue: number; orders: number }>()
        
        completedOrders.forEach((order) => {
          const branchId = (order as Order).branch_id
          if (branchId) {
            const current = branchSalesMap.get(branchId) || { revenue: 0, orders: 0 }
            branchSalesMap.set(branchId, {
              revenue: current.revenue + order.total,
              orders: current.orders + 1,
            })
          }
        })

        const branchSalesData = Array.from(branchSalesMap.entries()).map(([branch_id, stats]) => {
          const branch = branches.find((b) => b.id === branch_id)
          return {
            branch_id,
            branch_name: branch?.name || 'Sucursal desconocida',
            revenue: stats.revenue,
            orders: stats.orders,
          }
        })

        setSalesByBranch(branchSalesData)
      } else {
        setSalesByBranch([])
      }
    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const maxRevenue = useMemo(
    () => Math.max(...dailySales.map((d) => d.revenue), 1),
    [dailySales]
  )

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      Pendiente: 'bg-yellow-100 text-yellow-800',
      'En Proceso': 'bg-blue-100 text-blue-800',
      Enviado: 'bg-purple-100 text-purple-800',
      Entregado: 'bg-green-100 text-green-800',
      Cancelado: 'bg-red-100 text-red-800',
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reportes de Ventas</h1>
            <p className="text-gray-600 mt-2">Análisis detallado de tus ventas y rendimiento</p>
          </div>
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Sucursal</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500 min-w-[200px]"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} {branch.code && `(${branch.code})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {selectedBranch && (
          <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
            <Building2 className="h-4 w-4" />
            <span>Mostrando datos de: <strong>{selectedBranch.name}</strong></span>
          </div>
        )}
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Ingresos Totales</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.totalRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
              <span>{metrics.totalOrders} órdenes completadas</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Ticket Promedio</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.averageOrderValue)}</p>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <BarChart3 className="h-4 w-4 mr-1 text-blue-600" />
              <span>Por orden</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-50 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Este Mes</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.monthRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Package className="h-4 w-4 mr-1 text-purple-600" />
              <span>{metrics.monthOrders} órdenes</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-50 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Hoy</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.todayRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <ArrowUpRight className="h-4 w-4 mr-1 text-orange-600" />
              <span>{metrics.todayOrders} órdenes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Branch Summary (if no branch selected) */}
      {!selectedBranchId && salesByBranch.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Ventas por Sucursal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesByBranch
                .sort((a, b) => b.revenue - a.revenue)
                .map((branchSale) => {
                  const branch = branches.find((b) => b.id === branchSale.branch_id)
                  return (
                    <div
                      key={branchSale.branch_id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Building2 className="h-5 w-5 text-admin-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{branchSale.branch_name}</p>
                          <p className="text-xs text-gray-500">{branch?.code || 'Sin código'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatPrice(branchSale.revenue)}</p>
                        <p className="text-xs text-gray-500">{branchSale.orders} órdenes</p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ventas por período */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ventas por Período</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-600">Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.todayRevenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{metrics.todayOrders} órdenes</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-600">Esta Semana</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.weekRevenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{metrics.weekOrders} órdenes</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-600">Este Mes</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.monthRevenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{metrics.monthOrders} órdenes</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-600">Este Año</p>
                  <p className="text-2xl font-bold text-gray-900">{formatPrice(metrics.yearRevenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{metrics.yearOrders} órdenes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Órdenes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderStatusCounts.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        status.status
                      )}`}
                    >
                      {status.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{status.count} órdenes</p>
                    <p className="text-xs text-gray-500">{formatPrice(status.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de ventas diarias */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ventas Diarias</CardTitle>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedPeriod('7d')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedPeriod === '7d'
                    ? 'bg-admin-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                7 días
              </button>
              <button
                onClick={() => setSelectedPeriod('30d')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedPeriod === '30d'
                    ? 'bg-admin-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                30 días
              </button>
              <button
                onClick={() => setSelectedPeriod('90d')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  selectedPeriod === '90d'
                    ? 'bg-admin-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                90 días
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between space-x-1">
            {dailySales.map((day, index) => {
              const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
              const date = new Date(day.date)
              const dayLabel = date.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center group relative"
                  style={{ minWidth: '20px' }}
                >
                  <div
                    className="w-full bg-admin-600 rounded-t transition-all hover:bg-admin-700 cursor-pointer"
                    style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                    title={`${dayLabel}: ${formatPrice(day.revenue)} - ${day.orders} órdenes`}
                  />
                  {index % Math.ceil(dailySales.length / 7) === 0 && (
                    <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left whitespace-nowrap">
                      {dayLabel}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Productos más vendidos */}
      <Card>
        <CardHeader>
          <CardTitle>Productos Más Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cantidad Vendida
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ingresos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topProducts.map((product, index) => (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-admin-100 text-admin-700 font-semibold mr-3">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{product.product_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.total_quantity} unidades
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatPrice(product.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay datos de productos vendidos</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
