// Edge Function: mp-refresh-payment
// Manually fetches the current status of a MercadoPago payment and updates
// the order_payments record. Called from the admin UI when the webhook is
// missing or needs to be re-synced.
//
// POST body:
//   { mp_payment_id: string, organization_id: string }  — refresh by MP payment ID
//   { order_id: string, organization_id: string }       — search by external_reference when mp_payment_id is unknown (placeholder rows)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_API_BASE      = 'https://api.mercadopago.com'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MP_STATUS_MAP: Record<string, string> = {
  approved:     'processing',
  pending:      'pending',
  in_process:   'pending',
  rejected:     'cancelled',
  cancelled:    'cancelled',
  refunded:     'cancelled',
  charged_back: 'cancelled',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  let body: { mp_payment_id?: string; organization_id?: string; order_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { mp_payment_id, organization_id, order_id } = body
  if ((!mp_payment_id && !order_id) || !organization_id) {
    return new Response(JSON.stringify({ error: 'mp_payment_id or order_id, and organization_id are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  const { data: pmRow, error: pmError } = await supabase
    .from('organization_payment_methods')
    .select('config')
    .eq('organization_id', organization_id)
    .eq('key', 'mercadopago')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (pmError || !pmRow) {
    return new Response(JSON.stringify({ error: 'MercadoPago no configurado para esta organización' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const config = pmRow.config as Record<string, string> | null
  const accessToken = config?.access_token
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No hay access_token configurado' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let paymentData: Record<string, unknown>
  let resolvedOrderId = order_id

  if (mp_payment_id) {
    const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${mp_payment_id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!mpRes.ok) {
      const errText = await mpRes.text()
      console.error('MP API error:', mpRes.status, errText)
      return new Response(JSON.stringify({ error: `Error al consultar MercadoPago: ${mpRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    paymentData = await mpRes.json() as Record<string, unknown>
    resolvedOrderId = (paymentData.external_reference as string | undefined) ?? order_id
  } else {
    // Placeholder row: no mp_payment_id yet — search by external_reference (order_id)
    const searchUrl = `${MP_API_BASE}/v1/payments/search?external_reference=${encodeURIComponent(order_id!)}&sort=id&criteria=desc`
    const mpRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!mpRes.ok) {
      const errText = await mpRes.text()
      console.error('MP search API error:', mpRes.status, errText)
      return new Response(JSON.stringify({ error: `Error al buscar pagos en MercadoPago: ${mpRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const searchData = await mpRes.json() as { results?: Record<string, unknown>[] }
    const results = searchData.results ?? []
    if (results.length === 0) {
      return new Response(JSON.stringify({ error: 'No se encontraron pagos para esta orden en MercadoPago' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Most recent payment first (sorted by id desc)
    paymentData = results[0]
  }

  const mpStatus       = (paymentData.status as string) ?? 'pending'
  const mpStatusDetail = paymentData.status_detail as string | null
  const transactionAmt = (paymentData.transaction_amount as number) ?? 0
  const mpPaymentIdStr = String(paymentData.id)
  const newOrderStatus = MP_STATUS_MAP[mpStatus] ?? 'pending'

  if (mp_payment_id) {
    const { error: updatePaymentError } = await supabase
      .from('order_payments')
      .update({ mp_status: mpStatus } as never)
      .eq('mp_payment_id', mp_payment_id)
    if (updatePaymentError) {
      console.error('Error updating order_payment:', updatePaymentError)
      return new Response(JSON.stringify({ error: 'Error al actualizar el registro de pago' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else {
    // Update the placeholder row with the real mp_payment_id and status
    const { data: placeholderRow } = await supabase
      .from('order_payments')
      .select('id')
      .eq('order_id', resolvedOrderId!)
      .eq('payment_method', 'mercadopago')
      .is('mp_payment_id', null)
      .maybeSingle()

    if (placeholderRow) {
      await supabase
        .from('order_payments')
        .update({
          mp_payment_id: mpPaymentIdStr,
          mp_status:     mpStatus,
          amount:        transactionAmt,
        } as never)
        .eq('id', (placeholderRow as { id: string }).id)
    } else {
      await supabase
        .from('order_payments')
        .insert({
          order_id:       resolvedOrderId,
          payment_method: 'mercadopago',
          amount:         transactionAmt,
          mp_payment_id:  mpPaymentIdStr,
          mp_status:      mpStatus,
        } as never)
    }
  }

  if (resolvedOrderId) {
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', resolvedOrderId)
      .eq('organization_id', organization_id)
      .single()

    if (
      currentOrder &&
      !['delivered', 'shipped', 'cancelled', 'pending_allocation'].includes(currentOrder.status as string)
    ) {
      if (newOrderStatus !== currentOrder.status) {
        await supabase
          .from('orders')
          .update({ status: newOrderStatus } as never)
          .eq('id', resolvedOrderId)
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      mp_status: mpStatus,
      mp_status_detail: mpStatusDetail,
      amount: transactionAmt,
      order_id: resolvedOrderId,
      new_order_status: newOrderStatus,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
