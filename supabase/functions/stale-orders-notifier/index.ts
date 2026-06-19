// Edge Function: stale-orders-notifier
//
// Runs every hour via pg_cron.
// Detects orders stuck in intermediate states and notifies the merchant
// via Twilio (WhatsApp or SMS) using the same channel as daily-sales-summary.
//
// Deduplication: one notification per org per 6 hours (tracked in stale_order_notification_logs).
//
// Cases detected:
//   pending_allocation > 24h  → merchant forgot to assign stock
//   pending (non-MP)   > 2h   → cash/transfer promised but not confirmed
//   processing         > 7d   → order forgotten in processing
//
// Required env vars (same as daily-sales-summary):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_SID       = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM      = Deno.env.get('TWILIO_FROM_NUMBER')!
const TWILIO_API       = 'https://api.twilio.com/2010-04-01'

interface StaleOrdersSummary {
  organization_id:          string
  org_name:                 string
  twilio_phone:             string
  twilio_channel:           'whatsapp' | 'sms'
  pending_allocation_count: number
  pending_payment_count:    number
  stuck_processing_count:   number
}

async function sendTwilioMessage(opts: {
  to:      string
  body:    string
  channel: 'whatsapp' | 'sms'
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  const from = opts.channel === 'whatsapp' ? `whatsapp:${TWILIO_FROM}` : TWILIO_FROM
  const to   = opts.channel === 'whatsapp' ? `whatsapp:${opts.to}`    : opts.to

  const res = await fetch(
    `${TWILIO_API}/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:  `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      },
      body: new URLSearchParams({ From: from, To: to, Body: opts.body }).toString(),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: err }
  }

  const data = await res.json() as { sid: string }
  return { success: true, sid: data.sid }
}

function buildMessage(row: StaleOrdersSummary): string {
  const lines: string[] = [`⚠️ *${row.org_name} — Órdenes con atención requerida*`, '']

  if (row.pending_allocation_count > 0) {
    lines.push(`📋 *${row.pending_allocation_count}* orden${row.pending_allocation_count > 1 ? 'es' : ''} en pending_allocation sin asignar stock (+24h)`)
  }
  if (row.pending_payment_count > 0) {
    lines.push(`⏳ *${row.pending_payment_count}* orden${row.pending_payment_count > 1 ? 'es' : ''} con pago pendiente de confirmar (+2h)`)
  }
  if (row.stuck_processing_count > 0) {
    lines.push(`🔄 *${row.stuck_processing_count}* orden${row.stuck_processing_count > 1 ? 'es' : ''} en procesamiento sin avanzar (+7 días)`)
  }

  return lines.join('\n')
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.warn('[stale-orders-notifier] Twilio credentials not configured — skipping')
    return new Response(JSON.stringify({ skipped: true, reason: 'no_twilio_config' }), { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: summaries, error: queryError } = await (supabase.rpc as any)(
    'get_stale_orders_summary',
  )

  if (queryError) {
    console.error('[stale-orders-notifier] Failed to query stale orders:', queryError)
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 })
  }

  const rows = (summaries ?? []) as StaleOrdersSummary[]

  if (rows.length === 0) {
    console.log('[stale-orders-notifier] No stale orders found')
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 })
  }

  console.log(`[stale-orders-notifier] Found ${rows.length} org(s) with stale orders`)

  let notified = 0
  let skipped  = 0
  let errors   = 0

  for (const row of rows) {
    // Deduplication: skip if this org was notified in the last 6 hours
    const { data: recentLog } = await supabase
      .from('stale_order_notification_logs')
      .select('id')
      .eq('organization_id', row.organization_id)
      .gt('sent_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle()

    if (recentLog) {
      console.log(`[stale-orders-notifier] Org ${row.organization_id} already notified in last 6h — skipping`)
      skipped++
      continue
    }

    const body   = buildMessage(row)
    const result = await sendTwilioMessage({
      to:      row.twilio_phone,
      body,
      channel: row.twilio_channel ?? 'whatsapp',
    })

    if (!result.success) {
      console.error(`[stale-orders-notifier] Twilio error for org ${row.organization_id}:`, result.error)
      errors++
      continue
    }

    // Log the notification to prevent re-sending within 6 hours
    await supabase
      .from('stale_order_notification_logs')
      .insert({
        organization_id:          row.organization_id,
        pending_allocation_count: row.pending_allocation_count,
        pending_payment_count:    row.pending_payment_count,
        stuck_processing_count:   row.stuck_processing_count,
        twilio_sid:               result.sid,
      } as never)

    console.log(`[stale-orders-notifier] Notified org ${row.organization_id} (${row.org_name}) — sid: ${result.sid}`)
    notified++
  }

  const summary = { total: rows.length, notified, skipped, errors }
  console.log('[stale-orders-notifier] Done:', summary)

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
