import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckoutSteps } from '@/components/features/CheckoutSteps'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useToastStore } from '@/store/toastStore'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import { CheckCircle2, ArrowLeft, Package, CreditCard, Phone, Download, AlertCircle, Clock, RefreshCw, MessageCircle } from 'lucide-react'
import type { Order, OrderItem } from '@/types'

const getStatusLabel = (status: string | null): string => {
  const statusMap: Record<string, string> = {
    pending_allocation: 'Pendiente de asignación',
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mercadopago:  'Mercado Pago',
  transfer:     'Transferencia Bancaria',
  cash:         'Efectivo',
  credit_card:  'Tarjeta de Crédito',
}

export function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const mpStatus = searchParams.get('mp_status') // 'failure' | 'pending' | null (success)
  const settings = useOrgSettings()
  const primaryColor = 'var(--org-primary-color, #46362B)'
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [transferInstructions, setTransferInstructions] = useState<string>('')
  const [transferContactPhone, setTransferContactPhone] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshingMp, setRefreshingMp] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [orderId])

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

  const handleRefreshMpPayment = async () => {
    if (!order || !order.organization_id) return
    setRefreshingMp(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-refresh-payment`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ order_id: order.id, organization_id: order.organization_id }),
      })
      if (res.ok) {
        // Reload to show updated status
        window.location.reload()
      } else {
        useToastStore.getState().show('No se pudo verificar el estado del pago. Intentá de nuevo.', 'error')
      }
    } catch (err) {
      console.error('Error refreshing MP payment:', err)
      useToastStore.getState().show('No se pudo verificar el estado del pago. Intentá de nuevo.', 'error')
    } finally {
      setRefreshingMp(false)
    }
  }

  const whatsappDigits = transferContactPhone.replace(/\D/g, '')
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : ''

  const orderRef = order
    ? order.order_number
      ? `#${order.order_number}`
      : `#${order.id.slice(0, 8).toUpperCase()}`
    : ''
  const contactWhatsappHref = settings.store_whatsapp_number
    ? `https://wa.me/${settings.store_whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hola! Quiero coordinar mi orden ${orderRef}`
      )}`
    : null

  const handleDownloadReceipt = () => {
    if (!order) return

    const addr = order.shipping_address as Record<string, string> | null
    const orderRef = order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`
    const createdAt = order.created_at
      ? new Date(order.created_at).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : ''

    const itemsHtml = order.order_items
      .map((item) => {
        const variantLabel = item.variant?.name
          ? ` <span style="color:#6b7280;font-size:12px;">(${item.variant.name})</span>`
          : ''
        return `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${capitalizeFirst(item.product.name)}${variantLabel}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;">${item.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${formatPrice(item.price, settings)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${formatPrice(item.price * item.quantity, settings)}</td>
          </tr>`
      })
      .join('')

    const addressHtml = addr
      ? `<p style="margin:2px 0;">${addr.fullName ?? ''}</p>
         <p style="margin:2px 0;">${addr.address ?? ''}, ${addr.city ?? ''}</p>
         ${addr.email ? `<p style="margin:2px 0;">${addr.email}</p>` : ''}
         ${addr.phone ? `<p style="margin:2px 0;">Tel: ${addr.phone}</p>` : ''}`
      : ''

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Comprobante ${orderRef}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #374151; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .org-name { font-size: 20px; font-weight: 700; }
    .badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .section { margin-bottom: 20px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; text-align: left; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    .total-row td { padding-top: 12px; font-size: 15px; font-weight: 700; }
    .total-row td:last-child { text-align: right; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 16px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="org-name">${order.organization ? '' : ''}Comprobante de compra</div>
      <div style="color:#6b7280;margin-top:4px;">Orden ${orderRef} · ${createdAt}</div>
    </div>
    <div class="badge">✓ Confirmada</div>
  </div>

  ${addr ? `<div class="section">
    <h2>Datos del comprador</h2>
    <div style="color:#374151;line-height:1.6;">${addressHtml}</div>
  </div>` : ''}

  <div class="section">
    <h2>Productos</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center;">Cant.</th>
          <th style="text-align:right;">Precio unit.</th>
          <th style="text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td>${formatPrice(order.total, settings)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Pago</h2>
    <p>${order.payment_method === 'transfer' ? 'Transferencia bancaria' : order.payment_method === 'mercadopago' ? 'Mercado Pago' : capitalizeFirst(order.payment_method ?? '')}</p>
    <p style="margin-top:4px;color:#6b7280;">Estado: ${getStatusLabel(order.status)}</p>
  </div>

  <div class="footer">Generado el ${new Date().toLocaleString('es-UY')} · ${window.location.origin}</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=800,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

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
        <CheckoutSteps currentStep="confirmation" />

        {/* MP-specific status banners */}
        {order.payment_method === 'mercadopago' && mpStatus === 'failure' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">El pago fue rechazado</p>
              <p className="text-sm text-red-700 mt-0.5">
                Tu orden fue creada pero el pago no se completó. Podés intentar de nuevo o elegir otro método de pago.
              </p>
            </div>
          </div>
        )}

        {order.payment_method === 'mercadopago' && order.status === 'processing' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">Pago confirmado por Mercado Pago</p>
              <p className="text-sm text-green-700 mt-0.5">
                Tu pago fue acreditado correctamente. Ya estamos preparando tu orden.
              </p>
            </div>
          </div>
        )}

        {order.payment_method === 'mercadopago' && order.status === 'pending' && mpStatus !== 'failure' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <Clock className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-yellow-800">Pago en proceso</p>
              <p className="text-sm text-yellow-700 mt-0.5">
                Mercado Pago está procesando tu pago. El estado de la orden se actualizará automáticamente cuando se confirme.
              </p>
              <button
                type="button"
                onClick={handleRefreshMpPayment}
                disabled={refreshingMp}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-yellow-800 underline underline-offset-2 hover:text-yellow-900 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingMp ? 'animate-spin' : ''}`} />
                {refreshingMp ? 'Verificando...' : 'Verificar estado ahora'}
              </button>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Orden Confirmada!
          </h1>
          <p className="text-gray-600">
            Tu orden {orderRef} ha sido creada exitosamente
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
                <p className="text-sm text-gray-600">
                  {PAYMENT_METHOD_LABELS[order.payment_method] ?? capitalizeFirst(order.payment_method)}
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

        {contactWhatsappHref && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5" />
                <span>¿Necesitás coordinar tu pedido?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Escribinos por WhatsApp al{' '}
                <span className="font-semibold text-gray-900">{settings.store_whatsapp_number}</span>{' '}
                para coordinar la entrega o resolver cualquier duda sobre tu orden.
              </p>
              <a
                href={contactWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold text-white transition-colors w-full sm:w-auto"
                style={{ backgroundColor: primaryColor }}
              >
                <MessageCircle className="h-4 w-4" />
                Coordinar por WhatsApp
              </a>
            </CardContent>
          </Card>
        )}

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
                    <div className="w-16 h-16 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={capitalizeFirst(item.product.name)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px] text-center p-1">
                          Sin imagen
                        </div>
                      )}
                    </div>
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

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadReceipt}
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar comprobante
          </Button>
          <Link to="/">
            <Button
              className="text-white w-full sm:w-auto"
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
