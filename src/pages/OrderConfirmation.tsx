import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import { CheckCircle2, ArrowLeft, Package, CreditCard, Phone } from 'lucide-react'
import type { Order, OrderItem } from '@/types'

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

interface OrderWithItems extends Order {
  payment_method?: 'transfer' | 'mercadopago'
  order_items: Array<OrderItem & { product: { name: string; image_url: string | null } }>
}

export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchOrder()
    }
  }, [id])

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product:products (
              name,
              image_url
            )
          )
        `)
        .eq('id', id as string)
        .single()

      if (error) throw error
      setOrder(data as OrderWithItems)
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container-custom py-8 text-center">
        <p className="text-gray-600 text-lg mb-4">Orden no encontrada</p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Orden Confirmada!
          </h1>
          <p className="text-gray-600">
            Tu orden #{order.id.slice(0, 8)} ha sido creada exitosamente
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Detalles de la Orden</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <p className="font-semibold">{getStatusLabel(order.status)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-semibold text-lg text-primary-200">
                  {formatPrice(order.total)}
                </p>
              </div>
            </div>

            {order.payment_method && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Método de Pago</p>
                <p className="text-sm text-gray-600 capitalize">
                  {order.payment_method === 'transfer' ? 'Transferencia Bancaria' : 'Mercado Pago'}
                </p>
              </div>
            )}

            {order.shipping_address && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Dirección de Envío</p>
                <div className="text-sm text-gray-600">
                  <p>{(order.shipping_address as { fullName: string }).fullName}</p>
                  <p>{(order.shipping_address as { address: string }).address}</p>
                  <p>
                    {(order.shipping_address as { city: string }).city}, {(order.shipping_address as { state: string }).state}{' '}
                    {(order.shipping_address as { zipCode: string }).zipCode}
                  </p>
                  <p>{(order.shipping_address as { country: string }).country}</p>
                  <p className="mt-2">Tel: {(order.shipping_address as { phone: string | number }).phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-center space-x-4">
                  {item.product.image_url && (
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-gray-600">
                      Cantidad: {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="font-semibold">
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

        {/* Transfer Details - Only show if payment method is transfer */}
        {order.payment_method === 'transfer' && (
          <Card className="mb-6 border-2 border-primary-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Datos para Transferencia</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Realiza la transferencia por el monto total de la orden:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Banco:</span>
                    <span className="font-semibold text-gray-900">BROU</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo de Cuenta:</span>
                    <span className="font-semibold text-gray-900">Ahorro</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Número de Cuenta:</span>
                    <span className="font-semibold text-gray-900">0000000000000000000000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Titular:</span>
                    <span className="font-semibold text-gray-900">Flormaria Soria González</span>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Envía el comprobante de transferencia
                    </p>
                    <p className="text-sm text-yellow-800">
                      Por favor, envía una foto del comprobante de transferencia al siguiente número:
                    </p>
                    <a
                      href="https://wa.me/59898257909"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-primary-200 hover:underline mt-2 inline-block"
                    >
                      +598 98 257 909
                    </a>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Una vez recibido el comprobante, procesaremos tu orden y te notificaremos.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex justify-center space-x-4">
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continuar Comprando
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
