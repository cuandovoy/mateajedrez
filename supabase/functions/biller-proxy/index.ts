// Supabase Edge Function: biller-proxy
// Proxies requests to the Biller v2 API server-side, avoiding CORS.
//
// Security model:
//   - 'crear'        → allowed without JWT (guest checkout flow)
//   - 'anular'/'pdf' → require a valid Supabase JWT belonging to a member of the org

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const BILLER_BASE: Record<string, string> = {
  test:       'https://test.biller.uy/v2',
  production: 'https://biller.uy/v2',
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface BillerConfig {
  token: string
  ambiente: 'test' | 'production'
}

type Action = 'crear' | 'anular' | 'pdf'

interface RequestBody {
  action: Action
  organization_id: string
  payload?: unknown
  biller_id?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { action, organization_id, payload, biller_id } = body

  if (!action || !organization_id) {
    return json({ error: 'Missing action or organization_id' }, 400)
  }

  // ── Authorization ──────────────────────────────────────────────────────────
  // 'crear' is allowed without a JWT (guest checkout).
  // 'anular' and 'pdf' require a valid JWT from a member of the org.
  const authHeader = req.headers.get('Authorization') ?? ''

  if (action !== 'crear') {
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Authentication required' }, 401)
    }

    // Validate JWT and check org membership via RLS
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    // Check the user belongs to the organization
    const { data: membership } = await userClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return json({ error: 'Access denied to this organization' }, 403)
    }
  }

  // ── Load biller_config (service role, bypasses RLS) ────────────────────────
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: cfg, error: cfgError } = await admin
    .from('biller_config')
    .select('token, ambiente')
    .eq('organization_id', organization_id)
    .maybeSingle()

  if (cfgError || !cfg) {
    return json({ error: 'Biller config not found for this organization' }, 404)
  }

  const config = cfg as BillerConfig
  const base = BILLER_BASE[config.ambiente] ?? BILLER_BASE.test

  // ── Proxy to Biller ────────────────────────────────────────────────────────
  try {
    if (action === 'crear') {
      const res = await fetch(`${base}/comprobantes/crear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      return json(data, res.status)
    }

    if (action === 'anular') {
      const res = await fetch(`${base}/comprobantes/anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({ id: biller_id }),
      })
      const data = await res.json().catch(() => null)
      return json(data, res.status)
    }

    if (action === 'pdf') {
      const res = await fetch(`${base}/comprobantes/pdf?id=${biller_id}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      })
      if (!res.ok) {
        return json({ error: `Biller PDF error ${res.status}` }, res.status)
      }
      const buffer = await res.arrayBuffer()
      return new Response(buffer, {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/pdf' },
      })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: message }, 500)
  }
})
