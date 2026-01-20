import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import type { Order, OrderItem } from '@/types'
import { ArrowLeft, Calendar, CreditCard, MapPin, Package, Phone, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'En Proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return statusMap[status] || status
}

const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return colorMap[status] || 'bg-gray-100 text-gray-800'
}

interface OrderWithItems extends Order {
  payment_method?: 'transfer' | 'mercadopago'
  order_items: Array<OrderItem & { product: { name: string; image_url: string | null; sku: string } }>
  user_profile?: {
    full_name: string | null
    email: string
  } | null
}

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (id) {
      fetchOrder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      // Fetch order with items and products
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (
              name,
              image_url,
              sku
            )
          )
        `)
        .eq('id', id as string)
        .single()

      if (orderError) throw orderError
      if (!orderData) return

      const order = orderData as OrderWithItems

      // Fetch user profile if user_id exists
      let userProfile: { full_name: string | null; email: string } | null = null
      if (order.user_id) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('user_id', order.user_id)
          .single()

        if (profileData) {
          userProfile = {
            full_name: (profileData as { full_name: string }).full_name,
            email: 'N/A', // Email not available without admin functions
          }
        }
      }

      setOrder({
        ...order,
        order_items: order.order_items || [],
        user_profile: userProfile,
      } as OrderWithItems)
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!order || !id) return

    setUpdating(true)
    try {
      const { error } = await (supabase
        .from('orders') as any)
        .update({ status: newStatus } as any)
        .eq('id', id as string)

      if (error) throw error

      setOrder({ ...order, status: newStatus })
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error al actualizar el estado de la orden')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg mb-4">Orden no encontrada</p>
        <Link to="/admin/orders">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Órdenes
          </Button>
        </Link>
      </div>
    )
  }

  const shippingAddress = order.shipping_address as {
    fullName: string
    phone: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/admin/orders">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Órdenes
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Detalle de Orden</h1>
          <p className="text-gray-600 mt-2">ID: {order.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Información de la Orden</span>
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}
                >
                  {getStatusLabel(order.status)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Fecha de Creación</p>
                  <p className="font-medium flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(order.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-semibold text-lg text-primary-600">
                    {formatPrice(order.total)}
                  </p>
                </div>
              </div>

              {order.payment_method && (
                <div>
                  <p className="text-sm text-gray-600">Método de Pago</p>
                  <p className="font-medium capitalize">
                    {order.payment_method === 'transfer' ? 'Transferencia Bancaria' : 'Mercado Pago'}
                  </p>
                </div>
              )}

              {/* Status Update */}
              <div>
                <p className="text-sm text-gray-600 mb-2">Actualizar Estado</p>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map(
                    (status) => (
                      <Button
                        key={status}
                        variant={order.status === status ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusUpdate(status)}
                        disabled={updating || order.status === status}
                      >
                        {getStatusLabel(status)}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center space-x-4 border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-600">SKU: {item.product.sku}</p>
                      <p className="text-sm text-gray-600">
                        Cantidad: {item.quantity} × {formatPrice(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Cliente</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.user_profile ? (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Nombre</p>
                    <p className="font-medium">{order.user_profile.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{order.user_profile.email}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">Cliente Invitado</p>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Dirección de Envío</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Nombre</span>
                </p>
                <p className="font-medium">{shippingAddress.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>Teléfono</span>
                </p>
                <p className="font-medium">{shippingAddress.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Dirección</p>
                <p className="font-medium">{shippingAddress.address}</p>
                <p className="font-medium">
                  {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
                </p>
                <p className="font-medium">{shippingAddress.country}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          {order.payment_method === 'transfer' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Información de Pago</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">Método de Pago</p>
                <p className="font-medium">Transferencia Bancaria</p>
                <p className="text-xs text-gray-500 mt-2">
                  El cliente debe enviar el comprobante de transferencia
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
