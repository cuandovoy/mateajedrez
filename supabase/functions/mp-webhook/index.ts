// Edge Function: mp-webhook
// Receives payment notifications from Mercado Pago (IPN).
//
// Each organization has its own MP account and webhook secret stored in
// organization_payment_methods.config (keys: access_token, webhook_secret).
//
// The notification_url set in create-mp-preference includes the org_id:
//   .../functions/v1/mp-webhook?org=<organization_id>
//
// This allows us to look up the correct webhook_secret per org and verify
// the HMAC-SHA256 signature before processing anything.
//
// No global secrets required — fully multi-tenant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_API_BASE      = 'https://api.mercadopago.com'

const MP_STATUS_MAP: Record<string, string> = {
  approved:     'processing',
  pending:      'pending',
  in_process:   'pending',
  rejected:     'cancelled',
  cancelled:    'cancelled',
  refunded:     'cancelled',
  charged_back: 'cancelled',
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification
// Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
//
// MP sends:
//   x-signature:  ts=<unix-ts>,v1=<hex-hmac-sha256>
//   x-request-id: <uuid>
//
// Signed template: "id:<payment_id>;request-id:<x-request-id>;ts:<timestamp>;"
// ---------------------------------------------------------------------------
async function verifySignature(
  req: Request,
  paymentId: string | number,
  webhookSecret: string,
): Promise<boolean> {
  const xSignature = req.headers.get('x-signature') ?? ''
  const xRequestId = req.headers.get('x-request-id') ?? ''

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const eq = p.indexOf('=')
      return [p.slice(0, eq).trim(), p.slice(eq + 1).trim()]
    }),
  )

  const ts = parts['ts']
  const v1 = parts['v1']

  if (!ts || !v1) {
    console.error('x-signature header missing ts or v1:', xSignature)
    return false
  }

  const template = `id:${paymentId};request-id:${xRequestId};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(template),
  )

  const computed = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (computed !== v1) {
    console.error('Signature mismatch', { computed, received: v1, template })
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // MP sends GET to validate the endpoint when first configured in dashboard
  if (req.method === 'GET') {
    return new Response('ok', { status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Extract org_id from URL query param set by create-mp-preference
  const url = new URL(req.url)
  const organizationId = url.searchParams.get('org')

  if (!organizationId) {
    console.error('Missing ?org= query param in webhook URL')
    return new Response('missing org', { status: 400 })
  }

  const bodyText = await req.text()
  let body: { type?: string; action?: string; data?: { id?: string | number } }
  try {
    body = JSON.parse(bodyText)
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  // Only handle payment notifications
  if (body.type !== 'payment' && body.action !== 'payment.updated') {
    return new Response('ignored', { status: 200 })
  }

  const paymentId = body.data?.id
  if (!paymentId) {
    return new Response('missing payment id', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  // Look up the org's MP config (access_token + webhook_secret)
  const { data: pmRow, error: pmError } = await supabase
    .from('organization_payment_methods')
    .select('config')
    .eq('organization_id', organizationId)
    .eq('key', 'mercadopago')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (pmError || !pmRow) {
    console.error('MP method not found for org', organizationId)
    return new Response('org not found', { status: 200 }) // 200 so MP doesn't retry
  }

  const config        = pmRow.config as Record<string, string> | null
  const accessToken   = config?.access_token
  const webhookSecret = config?.webhook_secret

  if (!accessToken) {
    console.error('No access_token for org', organizationId)
    return new Response('no access_token', { status: 200 })
  }

  // Verify signature with the org's own webhook secret
  if (!webhookSecret) {
    console.warn(`Org ${organizationId} has no webhook_secret — skipping signature verification`)
  } else {
    const ok = await verifySignature(req, paymentId, webhookSecret)
    if (!ok) {
      console.error('Invalid signature for org', organizationId, 'payment', paymentId)
      return new Response('invalid signature', { status: 401 })
    }
  }

  try {
    // Fetch payment details from MP using this org's access_token
    const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!mpRes.ok) {
      console.error('MP API error fetching payment', paymentId, await mpRes.text())
      return new Response('mp api error', { status: 200 })
    }

    const paymentData = await mpRes.json() as Record<string, unknown>

    const orderId = paymentData.external_reference as string | undefined
    if (!orderId) {
      console.error('Payment has no external_reference:', paymentId)
      return new Response('no external_reference', { status: 200 })
    }

    const mpStatus       = (paymentData.status as string) ?? 'pending'
    const mpStatusDetail = paymentData.status_detail as string | null
    const newStatus      = MP_STATUS_MAP[mpStatus] ?? 'pending'
    const mpPaymentId    = String(paymentData.id)

    const { data: currentOrder } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .eq('organization_id', organizationId)
      .single()

    if (!currentOrder) {
      console.error('Order not found:', orderId)
      return new Response('order not found', { status: 200 })
    }

    // Don't touch orders in immutable or manually-managed statuses.
    // pending_allocation means the org handles stock allocation manually —
    // an MP payment notification should not skip that step.
    if (['delivered', 'shipped', 'pending_allocation'].includes(currentOrder.status as string)) {
      return new Response('order status is immutable', { status: 200 })
    }

    if (newStatus !== currentOrder.status) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus } as never)
        .eq('id', orderId)

      if (updateError) {
        console.error('Error updating order:', updateError)
        return new Response('db error', { status: 500 })
      }

      console.log(`[org:${organizationId}] Order ${orderId}: ${currentOrder.status} → ${newStatus} (MP: ${mpStatus}/${mpStatusDetail}, payment: ${mpPaymentId})`)
    }

    // Update or insert order_payment keyed by mp_payment_id.
    // Prefer updating the placeholder row created by create-mp-preference (mp_payment_id IS NULL)
    // so we don't end up with duplicate rows for the same order.
    const { data: existingPayment } = await supabase
      .from('order_payments')
      .select('id')
      .eq('order_id', orderId)
      .eq('mp_payment_id', mpPaymentId)
      .maybeSingle()

    if (existingPayment) {
      const { error: paymentUpdateError } = await supabase
        .from('order_payments')
        .update({
          mp_status: mpStatus,
          amount:    (paymentData.transaction_amount as number) ?? 0,
        } as never)
        .eq('id', (existingPayment as { id: string }).id)
      if (paymentUpdateError) {
        console.error('Error updating order_payment:', paymentUpdateError)
      }
    } else {
      // Check for the pending placeholder row created when the preference was generated
      const { data: placeholderPayment } = await supabase
        .from('order_payments')
        .select('id')
        .eq('order_id', orderId)
        .eq('payment_method', 'mercadopago')
        .is('mp_payment_id', null)
        .maybeSingle()

      if (placeholderPayment) {
        const { error: paymentUpdateError } = await supabase
          .from('order_payments')
          .update({
            mp_payment_id: mpPaymentId,
            mp_status:     mpStatus,
            amount:        (paymentData.transaction_amount as number) ?? 0,
          } as never)
          .eq('id', (placeholderPayment as { id: string }).id)
        if (paymentUpdateError) {
          console.error('Error updating placeholder order_payment:', paymentUpdateError)
        }
      } else {
        const { error: paymentInsertError } = await supabase
          .from('order_payments')
          .insert({
            order_id:       orderId,
            payment_method: 'mercadopago',
            amount:         (paymentData.transaction_amount as number) ?? 0,
            mp_payment_id:  mpPaymentId,
            mp_status:      mpStatus,
          } as never)
        if (paymentInsertError) {
          console.error('Error inserting order_payment:', paymentInsertError)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, order_id: orderId, new_status: newStatus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('mp-webhook unexpected error:', err)
    return new Response('internal error', { status: 200 })
  }
})
