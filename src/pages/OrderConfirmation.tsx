import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckoutSteps } from '@/components/features/CheckoutSteps'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useToastStore } from '@/store/toastStore'
import { isCouponDiscountMetadata } from '@/lib/coupons'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import { CheckCircle2, ArrowLeft, Package, CreditCard, Phone, Download, AlertCircle, Clock, RefreshCw, MessageCircle, Mail } from 'lucide-react'
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
  payment_method: 'transfer' | 'mercadopago' | 'cash' | null
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

// PENDING: replace with the real Mates Ajedrez contact email (not in the brand manual).
const TRANSFER_CONTACT_EMAIL = '[EMAIL DE CONTACTO]'

export function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const mpStatus = searchParams.get('mp_status') // 'failure' | 'pending' | null (success)
  const settings = useOrgSettings()
  const primaryColor = 'var(--org-primary-color, #705931)'
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [transferInstructions, setTransferInstructions] = useState<string>('')
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
      } else {
        setTransferInstructions('')
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
  const couponDiscountMetadata = order && isCouponDiscountMetadata(order.discount_metadata)
    ? order.discount_metadata
    : null
  const hasCouponDiscount = !!order && order.discount_total > 0
  const couponLabel = couponDiscountMetadata?.code ?? 'Cupón'
  const paymentMethodLabel = order
    ? (order.total === 0
        ? order.payment_method === 'mercadopago'
          ? 'Mercado Pago (sin pago requerido)'
          : 'Sin pago requerido'
        : PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? capitalizeFirst(order.payment_method ?? ''))
    : ''

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

    const summaryRowsHtml = `
        <tr>
          <td colspan="3" style="padding-top:12px;">Subtotal</td>
          <td style="padding-top:12px;text-align:right;">${formatPrice(order.subtotal_before_discount ?? order.total, settings)}</td>
        </tr>
        ${hasCouponDiscount ? `
        <tr>
          <td colspan="3" style="padding-top:8px;color:#166534;">${couponLabel}</td>
          <td style="padding-top:8px;text-align:right;color:#166534;">-${formatPrice(order.discount_total, settings)}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td>${formatPrice(order.total, settings)}</td>
        </tr>`

    const addressHtml = addr
      ? `<p style="margin:2px 0;">${addr.fullName ?? ''}</p>
         <p style="margin:2px 0;">${addr.address ?? ''}, ${addr.city ?? ''}${addr.department ? `, ${addr.department}` : ''}</p>
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
      <div class="org-name">Comprobante de compra</div>
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
        ${summaryRowsHtml}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Pago</h2>
    <p>${paymentMethodLabel}</p>
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
        <p className="text-brand-muted text-lg mb-4">Orden no encontrada</p>
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

        {hasCouponDiscount && order.total === 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-800">El cupón cubrió el total</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                No necesitás realizar ningún pago. Tu orden fue creada correctamente sin pasar por Mercado Pago.
              </p>
            </div>
          </div>
        )}

        {order.payment_method === 'mercadopago' && order.total > 0 && order.status === 'processing' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#C9D7B5] bg-[#EEF3E6] p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#46602B] mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-[#46602B]">Pago confirmado por Mercado Pago</p>
              <p className="text-sm text-[#46602B] mt-0.5">
                Tu pago fue acreditado correctamente. Ya estamos preparando tu orden.
              </p>
            </div>
          </div>
        )}

        {order.payment_method === 'mercadopago' && order.total > 0 && order.status === 'pending' && mpStatus !== 'failure' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-brand-algarrobo/40 bg-brand-crema p-4">
            <Clock className="h-5 w-5 shrink-0 text-brand-tinta mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-brand-tinta">Pago en proceso</p>
              <p className="text-sm text-brand-tinta mt-0.5">
                Mercado Pago está procesando tu pago. El estado de la orden se actualizará automáticamente cuando se confirme.
              </p>
              <button
                type="button"
                onClick={handleRefreshMpPayment}
                disabled={refreshingMp}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-tinta underline underline-offset-2 hover:text-brand-tinta disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingMp ? 'animate-spin' : ''}`} />
                {refreshingMp ? 'Verificando...' : 'Verificar estado ahora'}
              </button>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#EEF3E6] rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-[#46602B]" />
          </div>
          <h1 className="brand-title text-2xl md:text-3xl mb-2">
            ¡Orden Confirmada!
          </h1>
          <p className="text-brand-muted">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-brand-muted">Estado</p>
                <p className="font-semibold">{getStatusLabel(order.status)}</p>
              </div>
              <div>
                <p className="text-sm text-brand-muted">Subtotal</p>
                <p className="font-semibold">{formatPrice(order.subtotal_before_discount ?? order.total, settings)}</p>
              </div>
            </div>

            {hasCouponDiscount && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="font-medium text-brand-muted">{couponLabel}</p>
                  <p className="font-semibold text-emerald-700">-{formatPrice(order.discount_total, settings)}</p>
                </div>
                {couponDiscountMetadata?.applied_at && (
                  <p className="text-xs text-brand-muted">
                    Aplicado el {new Date(couponDiscountMetadata.applied_at).toLocaleString('es-UY')}
                  </p>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-brand-muted mb-2">Método de Pago</p>
              <p className="text-sm text-brand-muted">
                {paymentMethodLabel}
              </p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-brand-muted">Total</p>
              <p className="font-semibold text-lg" style={{ color: primaryColor }}>
                {formatPrice(order.total, settings)}
              </p>
            </div>

            {order.shipping_address && (() => {
              const shipping = order.shipping_address as {
                fullName?: string
                email?: string
                phone?: string
                address?: string
                city?: string
                department?: string
              }
              return (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-brand-muted mb-2">Dirección de Envío</p>
                  <div className="text-sm text-brand-muted">
                    <p>{shipping.fullName}</p>
                    {shipping.email && <p>Email: {shipping.email}</p>}
                    <p>{shipping.address}</p>
                    <p>{shipping.city}{shipping.department ? `, ${shipping.department}` : ''}</p>
                    <p className="mt-2">Tel: {shipping.phone}</p>
                  </div>
                </div>
              )
            })()}
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
              <p className="text-sm text-brand-muted">
                Escribinos por WhatsApp al{' '}
                <span className="font-semibold text-brand-tinta">{settings.store_whatsapp_number}</span>{' '}
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
                    <div className="w-16 h-16 rounded bg-brand-crema flex-shrink-0 overflow-hidden">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={capitalizeFirst(item.product.name)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-muted text-[10px] text-center p-1">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{capitalizeFirst(item.product.name)}</p>
                      {variant && (
                        <div className="mt-1 space-y-1">
                          {variant.name && (
                            <p className="text-sm font-medium text-brand-muted">
                              Variante: {capitalizeFirst(variant.name)}
                            </p>
                          )}
                          {variant.attributes && typeof variant.attributes === 'object' && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributes as Record<string, string>).map(([key, value]) => (
                                <span key={key} className="text-xs bg-brand-crema text-brand-muted px-2 py-0.5 rounded">
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-brand-muted">
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
              <div className="flex justify-between font-heading text-lg font-semibold">
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
                <p className="text-sm font-medium text-brand-muted mb-3">
                  Realiza la transferencia por el monto total de la orden:
                </p>
                {transferInstructions.trim() ? (
                  <pre className="text-sm text-brand-muted font-sans leading-6 text-bold">
                    {transferInstructions}
                  </pre>
                ) : (
                  <p className="text-sm text-brand-muted">
                    Esta organización no configuró aún los datos bancarios de transferencia.
                  </p>
                )}
              </div>
              <div className="bg-brand-crema border border-brand-algarrobo/40 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-brand-tinta mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-brand-tinta mb-1">
                      Envía el comprobante de transferencia
                    </p>
                    <p className="text-sm text-brand-tinta">
                      Por favor, envía una foto del comprobante de pago a este correo o WhatsApp:
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}>
                        <Mail className="h-4 w-4 shrink-0" />
                        <a href={`mailto:${TRANSFER_CONTACT_EMAIL}`} className="hover:underline">
                          {TRANSFER_CONTACT_EMAIL}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-brand-muted mt-2">
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
