// src/lib/billerSaleService.ts
// Servicio de negocio: convierte una orden de Axiostock en un CFE de Biller v2.

import { supabase } from '@/lib/supabase'
import { emitirComprobante, obtenerPDF, BillerApiError } from '@/lib/biller'
import {
  TIPO_COMPROBANTE,
  FORMA_PAGO,
  INDICADOR_FACTURACION,
} from '@/types/biller'
import type { BillerConfig, CheckoutBillerState, BillerComprobanteInput } from '@/types/biller'

// Mapeo de método de pago de Axiostock → Biller.
// La mayoría son contado; solo "credit" va como crédito.
const toFormaPago = (paymentMethod: string | null): number =>
  paymentMethod === 'credit' ? FORMA_PAGO.CREDITO : FORMA_PAGO.CONTADO

export interface OrderItemForBiller {
  product_id: string
  variant_id: string | null
  quantity: number
  price: number   // precio unitario
  name: string
}

export interface OrderForBiller {
  id: string
  organization_id: string
  payment_method: string | null
  items: OrderItemForBiller[]
}

export async function emitirCFEDesdeOrden(
  config: BillerConfig,
  order: OrderForBiller,
  billerState: CheckoutBillerState,
): Promise<{ billerId: number; pdfBlob: Blob }> {
  const tieneRUT = billerState.tipoComprobante === 'factura'
  const tipoComprobante = tieneRUT
    ? TIPO_COMPROBANTE.E_FACTURA
    : TIPO_COMPROBANTE.E_TICKET

  const payload = {
    tipo_comprobante: tipoComprobante,
    forma_pago: toFormaPago(order.payment_method),
    sucursal: config.sucursal_id,
    moneda: 'UYU' as const,
    montos_brutos: (config.montos_brutos ?? 1) as 0 | 1,
    numero_interno: order.id,
    cliente: tieneRUT && billerState.clienteDocumento
      ? {
          tipo_documento: billerState.clienteTipoDocumento,
          documento: billerState.clienteDocumento,
          nombre_fantasia: billerState.clienteNombre,
          sucursal: {
            pais: 'UY',
            emails: billerState.clienteEmail ? [billerState.clienteEmail] : [],
          },
        }
      : '-' as const,
    items: order.items.map((item) => ({
      cantidad: item.quantity,
      concepto: item.name,
      precio: item.price,
      indicador_facturacion: config.indicador_facturacion_default ?? INDICADOR_FACTURACION.TASA_BASICA,
    })),
  }

  let response: Awaited<ReturnType<typeof emitirComprobante>>
  try {
    response = await emitirComprobante(config, payload as BillerComprobanteInput)
  } catch (err) {
    // Guardar registro del intento fallido para trazabilidad
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('biller_comprobantes').insert({
      organization_id: order.organization_id,
      order_id: order.id,
      biller_id: null,
      tipo_comprobante: tipoComprobante,
      numero_interno: order.id,
      estado: 'error',
      raw_response: err instanceof BillerApiError
        ? { error: err.message, status: err.status, body: err.body }
        : { error: String(err) },
    }).maybeSingle() // ignorar si falla el insert del log

    throw err // re-lanzar para que el caller muestre el error al usuario
  }

  // CFE emitido — registrar en la DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('biller_comprobantes').insert({
    organization_id: order.organization_id,
    order_id: order.id,
    biller_id: response.id,
    tipo_comprobante: tipoComprobante,
    serie: response.serie,
    numero: response.numero,
    numero_interno: order.id,
    estado: 'emitido',
    raw_response: response,
  })

  // Obtener PDF — si falla no bloqueamos: el CFE ya fue emitido y está en la DB.
  // El admin puede re-descargarlo desde el detalle de la orden.
  let pdfBlob: Blob
  try {
    pdfBlob = await obtenerPDF(config, response.id)
  } catch {
    // Devolver un Blob vacío con flag para que el caller sepa que el CFE
    // fue emitido pero el PDF no pudo descargarse ahora.
    pdfBlob = new Blob([], { type: 'application/pdf' })
    return { billerId: response.id, pdfBlob, pdfFailed: true } as never
  }

  return { billerId: response.id, pdfBlob }
}
