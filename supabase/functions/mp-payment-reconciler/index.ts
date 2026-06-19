// Edge Function: mp-payment-reconciler
//
// Runs every 15 minutes via pg_cron.
// Finds orders stuck in 'pending' with an MP placeholder payment (mp_payment_id IS NULL)
// and queries the MP API to check if a payment was made but the IPN webhook was missed.
//
// Window: orders created between 10 minutes and 24 hours ago.
//   - < 10 min: give time for the normal IPN flow to arrive first
//   - > 24 h:   handled by abandoned-cart-cleanup (item 03)

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

interface StuckOrder {
  order_id:        string
  organization_id: string
  payment_row_id:  string
  access_token:    string
}

interface MpPayment {
  id:                 number
  status:             string
  transaction_amount: number
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  // Single query via RPC: orders pending + MP placeholder + 10min < age < 24h
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stuckOrders, error: queryError } = await (supabase.rpc as any)(
    'get_stuck_mp_orders',
  )

  if (queryError) {
    console.error('[mp-reconciler] Failed to query stuck orders:', queryError)
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 })
  }

  const orders = (stuckOrders ?? []) as StuckOrder[]

  if (orders.length === 0) {
    console.log('[mp-reconciler] No stuck orders found')
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  console.log(`[mp-reconciler] Found ${orders.length} stuck order(s)`)

  let processed = 0
  let skipped   = 0
  let errors    = 0

  for (const order of orders) {
    try {
      // Search MP for payments linked to this order via external_reference
      const searchRes = await fetch(
        `${MP_API_BASE}/v1/payments/search?external_reference=${order.order_id}&sort=date_last_updated&criteria=desc`,
        { headers: { Authorization: `Bearer ${order.access_token}` } },
      )

      if (!searchRes.ok) {
        console.error(`[mp-reconciler] MP search error for order ${order.order_id}: ${searchRes.status}`)
        errors++
        continue
      }

      const { results } = await searchRes.json() as { results: MpPayment[] }

      if (!results || results.length === 0) {
        // No payment found in MP — leave it for abandoned-cart-cleanup
        skipped++
        continue
      }

      // Prefer an approved payment; otherwise take the first actionable (non-pending) one
      const approved   = results.find((p) => p.status === 'approved')
      const actionable = approved ?? results.find((p) => p.status !== 'pending' && p.status !== 'in_process')

      if (!actionable) {
        // Payment still in_process or pending in MP — check again next cycle
        skipped++
        continue
      }

      const mpStatus      = actionable.status
      const newOrderStatus = MP_STATUS_MAP[mpStatus] ?? 'pending'

      // No-op guard: avoid a write if the status wouldn't change
      if (newOrderStatus === 'pending') {
        skipped++
        continue
      }

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: newOrderStatus } as never)
        .eq('id', order.order_id)

      if (orderError) {
        console.error(`[mp-reconciler] Failed to update order ${order.order_id}:`, orderError)
        errors++
        continue
      }

      // Fill in the placeholder order_payment row
      const { error: paymentError } = await supabase
        .from('order_payments')
        .update({
          mp_payment_id: String(actionable.id),
          mp_status:     mpStatus,
          amount:        actionable.transaction_amount ?? 0,
        } as never)
        .eq('id', order.payment_row_id)

      if (paymentError) {
        console.error(`[mp-reconciler] Failed to update order_payment for order ${order.order_id}:`, paymentError)
        // Order status was already updated — log but don't fail
      }

      console.log(
        `[mp-reconciler] [org:${order.organization_id}] Order ${order.order_id}: pending → ${newOrderStatus} (MP: ${mpStatus}, payment: ${actionable.id})`,
      )

      processed++
    } catch (err) {
      console.error(`[mp-reconciler] Unexpected error for order ${order.order_id}:`, err)
      errors++
    }
  }

  const summary = { total: orders.length, processed, skipped, errors }
  console.log('[mp-reconciler] Done:', summary)

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
