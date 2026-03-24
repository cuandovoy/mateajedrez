import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatPrice, formatDateShort } from '@/lib/utils'
import { ArrowLeft, ShoppingCart, DollarSign, Calendar, Package, Plus } from 'lucide-react'
import type { Customer } from '@/types/database.types'
import type { Order } from '@/types'
import { cn } from '@/lib/utils'

const getStatusLabel = (status: string | null): string => {
  const map: Record<string, string> = {
    pending_allocation: 'Pend. asignación',
    pending: 'Pendiente',
    processing: 'En proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return (status && map[status]) || status || 'Sin estado'
}

const getStatusColor = (status: string | null): string => {
  const map: Record<string, string> = {
    pending_allocation: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return (status && map[status]) || 'bg-gray-100 text-gray-800'
}

interface TopProduct {
  name: string
  sku: string
  quantity: number
}

export function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organizationId && id) fetchData()
  }, [organizationId, id])

  const fetchData = async () => {
    if (!organizationId || !id) return
    try {
      const [customerRes, ordersRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).eq('organization_id', organizationId).single(),
        supabase
          .from('orders')
          .select('*, order_items(id, quantity, unit_price, product_id, products(name, sku))')
          .eq('organization_id', organizationId)
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ])

      if (customerRes.error) throw customerRes.error
      setCustomer(customerRes.data as Customer)

      const ordersData = (ordersRes.data || []) as any[]
      setOrders(ordersData)

      // Aggregate top products
      const productMap = new Map<string, { name: string; sku: string; quantity: number }>()
      for (const order of ordersData) {
        for (const item of order.order_items || []) {
          const name = item.products?.name || 'Producto'
          const sku = item.products?.sku || ''
          const key = item.product_id || name
          const prev = productMap.get(key)
          if (prev) {
            prev.quantity += item.quantity || 1
          } else {
            productMap.set(key, { name, sku, quantity: item.quantity || 1 })
          }
        }
      }
      setTopProducts(
        Array.from(productMap.values())
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5)
      )
    } catch (err) {
      console.error('Error loading customer detail:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Cliente no encontrado.</p>
        <Button className="mt-4" onClick={() => navigate('/customers')}>Volver a clientes</Button>
      </div>
    )
  }

  const completedOrders = orders.filter((o) => ['delivered', 'shipped', 'processing'].includes(o.status || ''))
  const totalSpent = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)
  const firstOrder = orders[orders.length - 1]
  const lastOrder = orders[0]
  const address = (customer.address || {}) as any

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.full_name}</h1>
          {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
        </div>
        <div className="ml-auto">
          <Button onClick={() => navigate(`/orders?customer_id=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva orden
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-green-50 p-2.5 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total gastado</p>
              <p className="text-xl font-bold text-gray-900">{formatPrice(totalSpent, settings)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Órdenes totales</p>
              <p className="text-xl font-bold text-gray-900">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Primera compra</p>
              <p className="text-sm font-semibold text-gray-900">
                {firstOrder ? formatDateShort(firstOrder.created_at, settings) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-orange-50 p-2.5 rounded-lg">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Última compra</p>
              <p className="text-sm font-semibold text-gray-900">
                {lastOrder ? formatDateShort(lastOrder.created_at, settings) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Historial de órdenes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <p className="text-center py-10 text-gray-500 text-sm">Sin órdenes registradas</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            <Link
                              to={`/orders/${order.id}`}
                              className="font-medium text-admin-600 hover:underline"
                            >
                              #{order.order_number ? String(order.order_number).padStart(6, '0') : order.id.slice(0, 8).toUpperCase()}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateShort(order.created_at, settings)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(order.status))}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            {formatPrice(order.total || 0, settings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: contact + top products */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Datos de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
              {customer.phone && <p><span className="text-gray-500">Tel:</span> {customer.phone}</p>}
              {customer.email && <p><span className="text-gray-500">Email:</span> {customer.email}</p>}
              {customer.rut && <p><span className="text-gray-500">RUT:</span> {customer.rut}</p>}
              {address?.address && (
                <p>
                  <span className="text-gray-500">Dirección:</span>{' '}
                  {[address.address, address.city, address.state].filter(Boolean).join(', ')}
                </p>
              )}
              {customer.notes && (
                <p className="mt-2 text-gray-500 italic">{customer.notes}</p>
              )}
            </CardContent>
          </Card>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Productos más comprados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                    </div>
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      ×{p.quantity}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
