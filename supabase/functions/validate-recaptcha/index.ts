// Edge Function: validate-recaptcha
// Validates a reCAPTCHA v3 token with Google's siteverify API.
// Returns { success: boolean, score: number | null }
//
// POST /functions/v1/validate-recaptcha
// Body: { token: string }
//
// Required secret: RECAPTCHA_SECRET_KEY
// Deploy: supabase functions deploy validate-recaptcha
// Set secret: supabase secrets set RECAPTCHA_SECRET_KEY=<your_secret_key>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json() as { token?: string }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, score: null, error: 'Token requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY')
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY no configurado')
      return new Response(
        JSON.stringify({ success: false, score: null, error: 'Configuración incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: secretKey, response: token }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const data = await verifyRes.json() as {
      success: boolean
      score?: number
      action?: string
      'error-codes'?: string[]
    }

    return new Response(
      JSON.stringify({ success: data.success, score: data.score ?? null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('validate-recaptcha error:', err)
    return new Response(
      JSON.stringify({ success: false, score: null, error: 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
