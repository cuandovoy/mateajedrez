// Supabase Edge Function: send-notification
// Processes notification_queue items and sends emails via Resend.
// Invoked by Database Webhook on notification_queue INSERT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  renderNewOrder,
  renderLowStock,
  renderOrderStatus,
  STATUS_LABELS,
} from './email-templates.ts'

const RESEND_API_URL = 'https://api.resend.com/emails'

interface NotificationRecord {
  id: string
  organization_id: string
  type: string
  payload: Record<string, unknown>
  metadata: Record<string, unknown> | null
  status: string
  attempts: number
}

interface WebhookPayload {
  type?: string
  table?: string
  record?: NotificationRecord
  id?: string
}

// ─── Resend send ──────────────────────────────────────────────────────────────

/**
 * Sends an email via Resend.
 * - If `templateId` is provided → uses Resend template with `params` as variables.
 * - Otherwise → sends raw `html` (fallback for local/dev or when template not set).
 */
async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  apiKey: string
}): Promise<{ success: boolean; error?: string }> {
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notificaciones@resend.dev'

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[sendEmail] Resend error:', res.status, err)
    return { success: false, error: `Resend ${res.status}: ${err}` }
  }
  return { success: true }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl        = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey       = Deno.env.get('RESEND_API_KEY')

  if (!resendApiKey) {
    console.error('RESEND_API_KEY not set')
    return new Response(
      JSON.stringify({ error: 'Email service not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  let record: NotificationRecord | null = null

  try {
    const body = (await req.json()) as WebhookPayload

    if (body.record) {
      record = body.record as NotificationRecord
    } else if (body.id) {
      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', body.id)
        .single()
      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Notification not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }
      record = data as NotificationRecord
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing record or id in payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (record.status !== 'pending') {
      return new Response(JSON.stringify({ ok: true, skipped: 'already processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Load org info
    const { data: org } = await supabase
      .from('organizations')
      .select('name, slug, settings')
      .eq('id', record.organization_id)
      .single()

    const settings          = (org?.settings as Record<string, unknown>) ?? {}
    const notificationEmail = settings.notification_email as string | undefined
    const orgName           = (org?.name as string) ?? 'La tienda'
    const orgSlug           = (org?.slug as string) ?? ''

    // ── Helpers ──
    const failRecord = async (reason: string) => {
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', attempts: record!.attempts + 1, last_error: reason })
        .eq('id', record!.id)
    }

    let toEmail = ''
    let subject = ''
    let html    = ''

    // ── new_order ──────────────────────────────────────────────────────────────
    if (record.type === 'new_order') {
      const p = record.payload as {
        order_id: string
        total: number
        status: string
        created_at: string
      }
      toEmail = notificationEmail ?? ''
      if (!toEmail) {
        await failRecord('notification_email not configured')
        return new Response(JSON.stringify({ error: 'notification_email not configured' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const orderIdShort = (p.order_id ?? '').slice(0, 8).toUpperCase()
      const createdAt    = p.created_at
        ? new Date(p.created_at).toLocaleString('es-UY', { timeZone: 'America/Montevideo' })
        : 'N/A'
      const totalFmt     = new Intl.NumberFormat('es-UY').format(p.total ?? 0)
      const statusLabel  = STATUS_LABELS[p.status] ?? p.status

      subject = `🛒 Nueva orden #${orderIdShort} — ${orgName}`
      html    = renderNewOrder({ storeName: orgName, orderIdShort, orderId: p.order_id ?? '', total: totalFmt, statusLabel, createdAt })

    // ── low_stock ──────────────────────────────────────────────────────────────
    } else if (record.type === 'low_stock') {
      const p = record.payload as {
        product_name: string
        variant_name?: string | null
        branch_name: string
        stock: number
        threshold: number
        notification_email: string
      }
      toEmail = p.notification_email || notificationEmail || ''
      if (!toEmail) {
        await failRecord('notification_email not configured')
        return new Response(JSON.stringify({ error: 'notification_email not configured' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const itemLabel = p.variant_name ? `${p.product_name} — ${p.variant_name}` : p.product_name
      subject = `⚠️ Stock bajo: ${itemLabel} (${p.stock} unidades)`
      html    = renderLowStock({ storeName: orgName, productName: p.product_name, variantName: p.variant_name, branchName: p.branch_name, stock: p.stock, threshold: p.threshold })

    // ── order_status_customer ──────────────────────────────────────────────────
    } else if (record.type === 'order_status_customer') {
      const p = record.payload as {
        order_id: string
        new_status: string
        customer_email: string
        customer_name: string
      }
      toEmail = p.customer_email ?? ''
      if (!toEmail) {
        await failRecord('customer_email missing')
        return new Response(JSON.stringify({ error: 'customer_email missing' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const orderIdShort = (p.order_id ?? '').slice(0, 8).toUpperCase()
      const statusLabel  = STATUS_LABELS[p.new_status] ?? p.new_status
      subject = `${orgName} — Tu orden #${orderIdShort} fue actualizada: ${statusLabel}`
      html    = renderOrderStatus({ storeName: orgName, storeSlug: orgSlug, customerName: p.customer_name ?? 'Cliente', orderIdShort, newStatus: p.new_status })

    // ── unknown ────────────────────────────────────────────────────────────────
    } else {
      await failRecord(`Unknown type: ${record.type}`)
      return new Response(JSON.stringify({ error: `Unknown type: ${record.type}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── Send ───────────────────────────────────────────────────────────────────
    const result = await sendEmail({ to: toEmail, subject, html, apiKey: resendApiKey })

    if (result.success) {
      await supabase
        .from('notification_queue')
        .update({ status: 'sent', processed_at: new Date().toISOString() })
        .eq('id', record.id)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      await failRecord(result.error ?? 'Send failed')
      return new Response(
        JSON.stringify({ error: result.error ?? 'Send failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (err) {
    console.error('send-notification error:', err)
    if (record?.id) {
      try {
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', attempts: (record.attempts ?? 0) + 1, last_error: String(err) })
          .eq('id', record.id)
      } catch (updateErr) {
        console.error('Failed to update queue on error:', updateErr)
      }
    }
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
