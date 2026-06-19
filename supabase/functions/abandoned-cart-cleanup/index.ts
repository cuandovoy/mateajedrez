// Edge Function: abandoned-cart-cleanup
//
// Runs every 6 hours via pg_cron.
// Cancels MP orders that have been in 'pending' for more than 24 hours
// and have no active or approved payment in MP.
//
// Outcomes per MP search result:
//   approved          → process (mp-payment-reconciler missed it; handle it here)
//   pending/in_process → skip (bank transfer or slow acquirer — check again next cycle)
//   rejected/cancelled/no results → cancel order (trigger restores stock automatically)
//
// Cancelling a 'pending' order fires restore_branch_inventory_on_order_cancellation,
// which returns the decremented stock to branch_inventory.

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

const MP_ACTIVE_STATUSES = new Set(['pending', 'in_process'])

interface AbandonedOrder {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: abandonedOrders, error: queryError } = await (supabase.rpc as any)(
    'get_abandoned_mp_orders',
  )

  if (queryError) {
    console.error('[abandoned-cart-cleanup] Failed to query abandoned orders:', queryError)
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 })
  }

  const orders = (abandonedOrders ?? []) as AbandonedOrder[]

  if (orders.length === 0) {
    console.log('[abandoned-cart-cleanup] No abandoned orders found')
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  console.log(`[abandoned-cart-cleanup] Found ${orders.length} abandoned order(s)`)

  let cancelled  = 0
  let recovered  = 0
  let skipped    = 0
  let errors     = 0

  for (const order of orders) {
    try {
      // Search MP for any payment linked to this order
      const searchRes = await fetch(
        `${MP_API_BASE}/v1/payments/search?external_reference=${order.order_id}&sort=date_last_updated&criteria=desc`,
        { headers: { Authorization: `Bearer ${order.access_token}` } },
      )

      if (!searchRes.ok) {
        console.error(`[abandoned-cart-cleanup] MP search error for order ${order.order_id}: ${searchRes.status}`)
        errors++
        continue
      }

      const { results } = await searchRes.json() as { results: MpPayment[] }
      const payments = results ?? []

      // If any payment is still in_process or pending, MP is still trying — do not cancel
      const hasActivePayment = payments.some((p) => MP_ACTIVE_STATUSES.has(p.status))
      if (hasActivePayment) {
        console.log(`[abandoned-cart-cleanup] Order ${order.order_id} has active MP payment — skipping`)
        skipped++
        continue
      }

      // If there's an approved payment the reconciler missed, recover it
      const approvedPayment = payments.find((p) => p.status === 'approved')
      if (approvedPayment) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ status: 'processing' } as never)
          .eq('id', order.order_id)

        if (!orderError) {
          await supabase
            .from('order_payments')
            .update({
              mp_payment_id: String(approvedPayment.id),
              mp_status:     'approved',
              amount:        approvedPayment.transaction_amount ?? 0,
            } as never)
            .eq('id', order.payment_row_id)

          console.log(`[abandoned-cart-cleanup] [org:${order.organization_id}] Order ${order.order_id}: recovered approved payment ${approvedPayment.id}`)
          recovered++
        } else {
          console.error(`[abandoned-cart-cleanup] Failed to recover order ${order.order_id}:`, orderError)
          errors++
        }
        continue
      }

      // No active or approved payment found — cancel the order.
      // The trigger restore_branch_inventory_on_order_cancellation restores stock automatically.
      const { error: cancelError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' } as never)
        .eq('id', order.order_id)
        .eq('status', 'pending') // Guard: only cancel if still pending (idempotency)

      if (cancelError) {
        console.error(`[abandoned-cart-cleanup] Failed to cancel order ${order.order_id}:`, cancelError)
        errors++
        continue
      }

      // Record the final MP status on the placeholder payment row
      const lastMpStatus = payments.length > 0 ? payments[0].status : 'not_found'
      await supabase
        .from('order_payments')
        .update({ mp_status: lastMpStatus } as never)
        .eq('id', order.payment_row_id)

      console.log(`[abandoned-cart-cleanup] [org:${order.organization_id}] Order ${order.order_id}: cancelled (MP status: ${lastMpStatus})`)
      cancelled++
    } catch (err) {
      console.error(`[abandoned-cart-cleanup] Unexpected error for order ${order.order_id}:`, err)
      errors++
    }
  }

  const summary = { total: orders.length, cancelled, recovered, skipped, errors }
  console.log('[abandoned-cart-cleanup] Done:', summary)

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
