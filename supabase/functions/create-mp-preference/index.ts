// Edge Function: create-mp-preference
// Called from the checkout when the user selects Mercado Pago.
// Creates a MP preference and returns the init_point URL to redirect the user.
//
// POST /functions/v1/create-mp-preference
// Body: { order_id: string, organization_id: string }
// Returns: { init_point: string, preference_id: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MP_API_BASE       = 'https://api.mercadopago.com'

// The public URL of this Supabase project — used for back_urls and notification_url.
// Set as a secret: supabase secrets set PUBLIC_APP_URL=https://axiostock.com
const PUBLIC_APP_URL    = Deno.env.get('PUBLIC_APP_URL') ?? 'https://axiostock.com'
const SUPABASE_FUNCTIONS_URL = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.supabase.co') ?? SUPABASE_URL

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OrderItem {
  product: { name: string }
  variant?: { name: string | null } | null
  quantity: number
  price: number
}

interface Order {
  id: string
  order_number: number | null
  total: number
  organization_id: string
  shipping_address: Record<string, string> | null
  order_items: OrderItem[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, organization_id } = await req.json() as { order_id: string; organization_id: string }

    if (!order_id || !organization_id) {
      return new Response(JSON.stringify({ error: 'order_id y organization_id son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // 1. Fetch MP credentials for the organization
    const { data: pmRow, error: pmError } = await supabase
      .from('organization_payment_methods')
      .select('config, is_active')
      .eq('organization_id', organization_id)
      .eq('key', 'mercadopago')
      .limit(1)
      .maybeSingle()

    if (pmError || !pmRow?.is_active) {
      return new Response(JSON.stringify({ error: 'Mercado Pago no está activo para esta organización' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const config = pmRow.config as Record<string, string> | null
    const accessToken = config?.access_token
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Falta el access_token de Mercado Pago. Configuralo en la sección de métodos de pago.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Fetch the order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, total, organization_id, shipping_address,
        order_items (
          quantity, price,
          product:products ( name ),
          variant:product_variants ( name )
        )
      `)
      .eq('id', order_id)
      .eq('organization_id', organization_id)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Orden no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const typedOrder = order as unknown as Order

    // 3. Fetch org slug and currency (must come before mpItems to avoid TDZ on currencyId)
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('slug, settings')
      .eq('id', organization_id)
      .single()

    const orgSlug = (orgRow as { slug: string; settings: Record<string, unknown> | null } | null)?.slug ?? ''
    const orgSettings = (orgRow as { slug: string; settings: Record<string, unknown> | null } | null)?.settings ?? {}
    const currencyId = (orgSettings.currency as string | undefined) ?? 'UYU'
    const orderRef = typedOrder.order_number ?? order_id.slice(0, 8)

    // 4. Build MP preference items from order_items
    const mpItems = typedOrder.order_items.map((item) => {
      const variantSuffix = item.variant?.name ? ` - ${item.variant.name}` : ''
      return {
        id:          `${order_id}-${item.product.name}`,
        title:       `${item.product.name}${variantSuffix}`,
        quantity:    item.quantity,
        unit_price:  item.price,
        currency_id: currencyId,
      }
    })

    // 5. POST to MP Preferences API
    // Include org_id in the webhook URL so mp-webhook knows which secret to use
    const notificationUrl = `${SUPABASE_FUNCTIONS_URL}/functions/v1/mp-webhook?org=${organization_id}`
    const preference = {
      items:           mpItems,
      external_reference: order_id, // used in webhook to find the order
      back_urls: {
        success: `${PUBLIC_APP_URL}/${orgSlug}/order-confirmation/${order_id}`,
        failure: `${PUBLIC_APP_URL}/${orgSlug}/order-confirmation/${order_id}?mp_status=failure`,
        pending: `${PUBLIC_APP_URL}/${orgSlug}/order-confirmation/${order_id}?mp_status=pending`,
      },
      auto_return:      'approved',
      notification_url: notificationUrl,
      statement_descriptor: `Orden ${orderRef}`,
      metadata: {
        order_id,
        organization_id,
      },
    }

    const isSandbox = config?.sandbox === 'true'
    const mpResponse = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'X-Sandbox':     isSandbox ? '1' : '0',
      },
      body: JSON.stringify(preference),
    })

    if (!mpResponse.ok) {
      const mpError = await mpResponse.json()
      console.error('MP API error:', mpError)
      return new Response(JSON.stringify({ error: 'Error al crear la preferencia en Mercado Pago', detail: mpError }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mpData = await mpResponse.json() as { id: string; init_point: string; sandbox_init_point: string }

    // 6. Create a placeholder order_payment row (mp_payment_id = NULL).
    // The webhook will fill in the real mp_payment_id and mp_status once the payment completes.
    await supabase
      .from('order_payments')
      .insert({
        order_id:       order_id,
        payment_method: 'mercadopago',
        amount:         typedOrder.total,
        mp_status:      'pending',
      } as never)

    const initPoint = isSandbox ? mpData.sandbox_init_point : mpData.init_point

    return new Response(JSON.stringify({ init_point: initPoint, preference_id: mpData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
