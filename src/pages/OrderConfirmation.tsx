import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import { CheckCircle2, ArrowLeft, Package, CreditCard, Phone } from 'lucide-react'
import type { Order, OrderItem } from '@/types'

const getStatusLabel = (status: string | null): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'En Proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return (status && statusMap[status]) || status || 'Sin estado'
}

interface OrderWithItems extends Order {
  payment_method: 'transfer' | 'mercadopago' | 'cash'
  organization?: {
    settings?: Record<string, unknown> | null
  } | null
  order_items: Array<OrderItem & { 
    product: { name: string; image_url: string | null }
    variant?: { 
      id: string
      name: string | null
      sku: string
      attributes: Record<string, string>
      image_url: string | null
    } | null
  }>
}

export function OrderConfirmation() {
  const { slug, orderId } = useParams<{ slug?: string; orderId: string }>()
  const settings = useOrgSettings()
  const primaryColor = 'var(--org-primary-color, #6366f1)'
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [transferInstructions, setTransferInstructions] = useState<string>('')
  const [transferContactPhone, setTransferContactPhone] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          organization:organizations (
            settings
          ),
          order_items (
            *,
            product:products (
              name,
              image_url
            ),
            variant:product_variants (
              id,
              name,
              sku,
              attributes,
              image_url
            )
          )
        `)
        .eq('id', orderId as string)
        .single()

      if (error) throw error
      const orderData = data as OrderWithItems
      setOrder(orderData)

      if (orderData.payment_method === 'transfer' && orderData.organization_id) {
        const { data: transferMethodData } = await supabase
          .from('organization_payment_methods')
          .select('config')
          .eq('organization_id', orderData.organization_id)
          .eq('key', 'transfer')
          .limit(1)
          .maybeSingle()

        const transferConfig = (transferMethodData as { config?: Record<string, unknown> } | null)?.config
        const instructions =
          transferConfig && typeof transferConfig.transfer_instructions === 'string'
            ? transferConfig.transfer_instructions
            : ''
        setTransferInstructions(instructions)

        const orgSettings = (orderData.organization?.settings || {}) as Record<string, unknown>
        const contactPhone =
          typeof orgSettings.transfer_contact_phone === 'string'
            ? orgSettings.transfer_contact_phone.trim()
            : ''
        setTransferContactPhone(contactPhone)
      } else {
        setTransferInstructions('')
        setTransferContactPhone('')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const whatsappDigits = transferContactPhone.replace(/\D/g, '')
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : ''

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: primaryColor }}
        />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container-custom py-8 text-center">
        <p className="text-gray-600 text-lg mb-4">Orden no encontrada</p>
        <Link to={slug ? `/${slug}` : '/'}>
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
                <p className="font-semibold text-lg" style={{ color: primaryColor }}>
                  {formatPrice(order.total, settings)}
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
                  {(order.shipping_address as { email?: string }).email && (
                    <p>Email: {(order.shipping_address as { email: string }).email}</p>
                  )}
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
              {order.order_items?.map((item) => {
                const variant = item.variant
                const displayImage = variant?.image_url || item.product.image_url
                
                return (
                  <div key={item.id} className="flex items-center space-x-4">
                    {displayImage && (
                      <img
                        src={displayImage}
                        alt={capitalizeFirst(item.product.name)}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{capitalizeFirst(item.product.name)}</p>
                      {variant && (
                        <div className="mt-1 space-y-1">
                          {variant.name && (
                            <p className="text-sm font-medium text-gray-700">
                              Variante: {capitalizeFirst(variant.name)}
                            </p>
                          )}
                          {variant.attributes && typeof variant.attributes === 'object' && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributes as Record<string, string>).map(([key, value]) => (
                                <span key={key} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-600">
                        Cantidad: {item.quantity} × {formatPrice(item.price, settings)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatPrice(item.price * item.quantity, settings)}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="border-t mt-4 pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(order.total, settings)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transfer Details - Only show if payment method is transfer */}
        {order.payment_method === 'transfer' && (
          <Card className="mb-6 border-2" style={{ borderColor: `color-mix(in srgb, ${primaryColor} 40%, white)` }}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Datos para Transferencia</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, white)` }}>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Realiza la transferencia por el monto total de la orden:
                </p>
                {transferInstructions.trim() ? (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-6">
                    {transferInstructions}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-600">
                    Esta organización no configuró aún los datos bancarios de transferencia.
                  </p>
                )}
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Envía el comprobante de transferencia
                    </p>
                    {transferContactPhone ? (
                      <>
                        <p className="text-sm text-yellow-800">
                          Por favor, envía una foto del comprobante de transferencia al siguiente número:
                        </p>
                        {whatsappHref ? (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold hover:underline mt-2 inline-block"
                            style={{ color: primaryColor }}
                          >
                            {transferContactPhone}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold mt-2" style={{ color: primaryColor }}>
                            {transferContactPhone}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-yellow-800">
                        Esta organización no configuró un teléfono de contacto para comprobantes.
                      </p>
                    )}
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
          <Link to={slug ? `/${slug}` : '/'}>
            <Button
              variant="outline"
              className="text-white"
              style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continuar Comprando
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
