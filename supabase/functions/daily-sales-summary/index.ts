// Supabase Edge Function: daily-sales-summary
// Enviado por pg_cron cada hora. Para cada organización con resumen diario
// habilitado, verifica si es la hora de envío configurada y manda un
// mensaje vía Twilio (WhatsApp o SMS) con ventas y gastos del día.
//
// Variables de entorno requeridas:
//   TWILIO_ACCOUNT_SID   — SID de la cuenta Twilio
//   TWILIO_AUTH_TOKEN    — Auth token de Twilio
//   TWILIO_FROM_NUMBER   — Número origen (ej: +14155238886 para sandbox WA)
//   SUPABASE_URL         — URL del proyecto (inyectada automáticamente)
//   SUPABASE_SERVICE_ROLE_KEY — Service role key (inyectada automáticamente)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_API = 'https://api.twilio.com/2010-04-01'

interface DailySummaryConfig {
  enabled: boolean
  phone: string
  send_hour: number
  timezone: string
  channel: 'whatsapp' | 'sms'
}

interface MessageVariables {
  '1': string  // orgName
  '2': string  // date
  '3': string  // total_sales
  '4': string  // order_count + label
  '5': string  // total_expenses
  '6': string  // balance with sign
}

interface OrgRow {
  id: string
  name: string
  settings: Record<string, unknown>
}

interface DailySummaryMetrics {
  total_sales: number
  order_count: number
  total_expenses: number
}

// ─── Twilio ───────────────────────────────────────────────────────────────────

async function sendTwilioMessage(opts: {
  accountSid: string
  authToken: string
  from: string
  to: string
  body: string
  variables: MessageVariables
  channel: 'whatsapp' | 'sms'
  contentSid?: string
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  const { accountSid, authToken, from, to, body, variables, channel, contentSid } = opts

  const fromAddr = channel === 'whatsapp' ? `whatsapp:${from}` : from
  const toAddr   = channel === 'whatsapp' ? `whatsapp:${to}`   : to

  const params = new URLSearchParams({ From: fromAddr, To: toAddr })

  // Si hay ContentSid (plantilla WhatsApp aprobada por Meta) la usamos.
  // Si no, enviamos Body libre (funciona en sandbox y para SMS).
  if (contentSid && channel === 'whatsapp') {
    params.append('ContentSid', contentSid)
    params.append('ContentVariables', JSON.stringify(variables))
  } else {
    params.append('Body', body)
  }

  const res = await fetch(
    `${TWILIO_API}/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: params.toString(),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    console.error('[sendTwilioMessage] error:', JSON.stringify(data))
    return { success: false, error: data.message ?? `HTTP ${res.status}` }
  }
  return { success: true, sid: data.sid }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrgLocalDate(timezone: string): { date: string; hour: number } {
  // Obtiene fecha y hora actuales en la zona horaria de la org
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  const date = `${get('year')}-${get('month')}-${get('day')}`
  const hour = parseInt(get('hour'), 10)
  return { date, hour }
}

function formatDateDMY(isoDate: string): string {
  // Convierte YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function buildMessageVariables(
  orgName: string,
  date: string,
  metrics: DailySummaryMetrics,
): MessageVariables {
  const { total_sales, order_count, total_expenses } = metrics
  const balance = total_sales - total_expenses
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
  return {
    '1': orgName,
    '2': formatDateDMY(date),
    '3': fmt(total_sales),
    '4': `${order_count} ${order_count === 1 ? 'orden' : 'órdenes'}`,
    '5': fmt(total_expenses),
    '6': `${balance >= 0 ? '+' : ''}${fmt(balance)}`,
  }
}

function buildFreeFormBody(vars: MessageVariables): string {
  return [
    `📊 Resumen diario — ${vars['1']}`,
    `📅 ${vars['2']}`,
    ``,
    `💰 Ventas:  $${vars['3']} (${vars['4']})`,
    `💸 Gastos:  $${vars['5']}`,
    `📈 Balance: $${vars['6']}`,
  ].join('\n')
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Debe estar en TODAS las respuestas, no solo en OPTIONS.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!
  const supabaseKey      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Requiere al menos que exista un Authorization header (Bearer token).
  // El gateway ya no verifica JWT (--no-verify-jwt), pero sí exigimos
  // que venga algún token para evitar llamadas anónimas sin ningún contexto.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing authorization' }, 401)
  }
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const twilioAuthToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
  const twilioFrom       = Deno.env.get('TWILIO_FROM_NUMBER')
  // Opcional: SID de plantilla aprobada por Meta. Si no está, se usa Body libre.
  const twilioContentSid = Deno.env.get('TWILIO_CONTENT_SID')

  // DEBUG temporal: loguear primeros chars para verificar que los secrets llegan
  console.log('[debug] ACCOUNT_SID:', twilioAccountSid?.slice(0, 6) ?? 'MISSING')
  console.log('[debug] AUTH_TOKEN:', twilioAuthToken ? twilioAuthToken.slice(0, 4) + '...' + twilioAuthToken.slice(-4) : 'MISSING')
  console.log('[debug] FROM:', twilioFrom ?? 'MISSING')

  if (!twilioAccountSid || !twilioAuthToken || !twilioFrom) {
    console.error('[daily-sales-summary] Twilio credentials not set')
    return new Response(
      JSON.stringify({ error: 'Twilio credentials not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // El body puede traer { scheduled: true } (desde pg_cron)
  // o { organization_id: "uuid", test: true } (desde la UI para prueba manual)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body vacío está ok */ }

  const manualOrgId = typeof body.organization_id === 'string' ? body.organization_id : null
  const isTest      = body.test === true

  // Traer orgs: si es manual solo la org pedida, si es cron todas las habilitadas
  let orgsQuery = supabase.from('organizations').select('id, name, settings')
  if (manualOrgId) orgsQuery = orgsQuery.eq('id', manualOrgId)

  const { data: orgs, error: orgsErr } = await orgsQuery

  if (orgsErr) {
    console.error('[daily-sales-summary] Error fetching orgs:', orgsErr)
    return new Response(
      JSON.stringify({ error: orgsErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Para cron filtramos solo habilitadas; para manual enviamos aunque esté deshabilitada
  const enabledOrgs = ((orgs ?? []) as OrgRow[]).filter((org) => {
    const cfg = org.settings?.daily_summary as DailySummaryConfig | undefined
    if (!cfg?.phone?.trim()) return false
    return manualOrgId ? true : cfg.enabled === true
  })

  const results: Array<{
    org_id: string
    org_name: string
    status: 'sent' | 'skipped' | 'failed'
    reason?: string
  }> = []

  for (const org of enabledOrgs) {
    const cfg = org.settings.daily_summary as DailySummaryConfig
    const timezone  = cfg.timezone  || 'UTC'
    const sendHour  = cfg.send_hour ?? 20
    const phone     = cfg.phone.trim()
    const channel   = cfg.channel  || 'whatsapp'

    const { date: orgDate, hour: orgHour } = getOrgLocalDate(timezone)

    // En modo cron: respetar hora configurada
    if (!manualOrgId && orgHour !== sendHour) {
      results.push({ org_id: org.id, org_name: org.name, status: 'skipped', reason: `hour ${orgHour} != ${sendHour}` })
      continue
    }

    // En modo cron: evitar doble envío. En modo test: siempre enviar.
    if (!isTest) {
      const { data: existingLog } = await supabase
        .from('daily_summary_logs')
        .select('id')
        .eq('organization_id', org.id)
        .eq('date_covered', orgDate)
        .eq('status', 'sent')
        .maybeSingle()

      if (existingLog) {
        results.push({ org_id: org.id, org_name: org.name, status: 'skipped', reason: 'already sent today' })
        continue
      }
    }

    // Obtener métricas del día
    const { data: metricsRows, error: metricsErr } = await supabase.rpc('get_daily_summary', {
      p_organization_id: org.id,
      p_date:            orgDate,
      p_timezone:        timezone,
    })

    if (metricsErr || !metricsRows?.length) {
      console.error(`[daily-sales-summary] metrics error for org ${org.id}:`, metricsErr)
      await supabase.from('daily_summary_logs').insert({
        organization_id: org.id,
        date_covered:    orgDate,
        phone,
        channel,
        status:          'failed',
        error:           metricsErr?.message ?? 'No metrics returned',
      })
      results.push({ org_id: org.id, org_name: org.name, status: 'failed', reason: metricsErr?.message })
      continue
    }

    const metrics: DailySummaryMetrics = {
      total_sales:    Number(metricsRows[0].total_sales    ?? 0),
      order_count:    Number(metricsRows[0].order_count    ?? 0),
      total_expenses: Number(metricsRows[0].total_expenses ?? 0),
    }

    const vars    = buildMessageVariables(org.name, orgDate, metrics)
    const body    = buildFreeFormBody(vars)

    // Enviar por Twilio
    const twilioResult = await sendTwilioMessage({
      accountSid: twilioAccountSid,
      authToken:  twilioAuthToken,
      from:       twilioFrom,
      to:         phone,
      body,
      variables:  vars,
      channel,
      contentSid: twilioContentSid ?? undefined,
    })

    // Registrar resultado
    await supabase.from('daily_summary_logs').insert({
      organization_id: org.id,
      date_covered:    orgDate,
      total_sales:     metrics.total_sales,
      order_count:     metrics.order_count,
      total_expenses:  metrics.total_expenses,
      phone,
      channel,
      status:          twilioResult.success ? 'sent' : 'failed',
      error:           twilioResult.success ? null : twilioResult.error,
      twilio_sid:      twilioResult.sid ?? null,
    })

    results.push({
      org_id:   org.id,
      org_name: org.name,
      status:   twilioResult.success ? 'sent' : 'failed',
      reason:   twilioResult.error,
    })

    console.log(
      `[daily-sales-summary] org=${org.name} date=${orgDate} status=${twilioResult.success ? 'sent' : 'failed'}`,
      twilioResult.success ? `sid=${twilioResult.sid}` : `error=${twilioResult.error}`
    )
  }

  return json({ ok: true, processed: results.length, results })
})
