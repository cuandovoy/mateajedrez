// Supabase Edge Function: send-notification
// Processes notification_queue items and sends emails via Resend.
// Invoked by Database Webhook on notification_queue INSERT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com/emails'

interface NotificationRecord {
  id: string
  organization_id: string
  type: string
  payload: Record<string, unknown>
  metadata: Record<string, unknown> | null
  status: string
}

interface WebhookPayload {
  type?: string
  table?: string
  record?: NotificationRecord
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'En Proceso',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL') ?? 'notificaciones@resend.dev',
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: err }
  }
  return { success: true }
}

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

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

    const { data: org } = await supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', record.organization_id)
      .single()

    const settings = (org?.settings as Record<string, unknown>) ?? {}
    const notificationEmail = settings.notification_email as string | undefined

    let toEmail: string
    let subject: string
    let html: string

    if (record.type === 'new_order') {
      const payload = record.payload as { order_id: string; total: number; status: string; created_at: string }
      toEmail = notificationEmail ?? ''
      if (!toEmail) {
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            attempts: record.attempts + 1,
            last_error: 'notification_email not configured',
          })
          .eq('id', record.id)
        return new Response(JSON.stringify({ error: 'notification_email not configured' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      subject = `Nueva orden #${(payload.order_id ?? '').slice(0, 8)}`
      html = `
        <h2>Nueva orden recibida</h2>
        <p><strong>Orden:</strong> ${payload.order_id}</p>
        <p><strong>Total:</strong> ${payload.total}</p>
        <p><strong>Estado:</strong> ${payload.status}</p>
        <p><strong>Fecha:</strong> ${payload.created_at ?? 'N/A'}</p>
      `
    } else if (record.type === 'order_status_customer') {
      const payload = record.payload as {
        order_id: string
        new_status: string
        customer_email: string
        customer_name: string
      }
      toEmail = payload.customer_email ?? ''
      if (!toEmail) {
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            attempts: record.attempts + 1,
            last_error: 'customer_email missing',
          })
          .eq('id', record.id)
        return new Response(JSON.stringify({ error: 'customer_email missing' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const orgName = (org?.name as string) ?? 'La tienda'
      subject = `Actualización de tu orden - ${orgName}`
      html = `
        <h2>Hola ${payload.customer_name ?? 'Cliente'}</h2>
        <p>Tu orden <strong>#${(payload.order_id ?? '').slice(0, 8)}</strong> ha sido actualizada.</p>
        <p><strong>Nuevo estado:</strong> ${getStatusLabel(payload.new_status)}</p>
        <p>Gracias por tu compra.</p>
      `
    } else {
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          attempts: record.attempts + 1,
          last_error: `Unknown type: ${record.type}`,
        })
        .eq('id', record.id)
      return new Response(JSON.stringify({ error: `Unknown type: ${record.type}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await sendEmail(toEmail, subject, html, resendApiKey)

    if (result.success) {
      await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          processed_at: new Date().toISOString(),
        })
        .eq('id', record.id)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          attempts: record.attempts + 1,
          last_error: result.error ?? 'Send failed',
        })
        .eq('id', record.id)
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
        .update({
          status: 'failed',
          attempts: (record.attempts ?? 0) + 1,
          last_error: String(err),
        })
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
