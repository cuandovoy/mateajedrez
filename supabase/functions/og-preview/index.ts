// Supabase Edge Function: og-preview
// Returns an HTML page with Open Graph meta tags for a given org slug.
// Real browsers are immediately redirected to the SPA; crawlers (no JS) read the OG tags.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://axiostock.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface OrgRow {
  name: string
  slug: string
  logo_url: string | null
  cover_image_url: string | null
  settings: Record<string, unknown> | null
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // Expect path: /og-preview/{slug}
  const parts = url.pathname.split('/').filter(Boolean)
  const slug = parts[parts.length - 1]

  if (!slug || slug === 'og-preview') {
    return new Response('Not found', { status: 404 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: org, error } = await supabase
    .from('organizations')
    .select('name, slug, logo_url, cover_image_url, settings')
    .eq('slug', slug)
    .single<OrgRow>()

  if (error || !org) {
    // Slug not found — redirect to SPA anyway
    return Response.redirect(`${SITE_URL}/${slug}`, 302)
  }

  const settings = (org.settings ?? {}) as Record<string, unknown>

  // Cover images: prefer settings array, then cover_image_url
  const settingsCoverImages = Array.isArray(settings['store_cover_image_urls'])
    ? (settings['store_cover_image_urls'] as string[]).filter((v) => typeof v === 'string' && v.trim())
    : []
  const ogImage =
    settingsCoverImages[0] ||
    (typeof org.cover_image_url === 'string' ? org.cover_image_url : null) ||
    (typeof org.logo_url === 'string' ? org.logo_url : null) ||
    `${SITE_URL}/og-default.png`

  const title = org.name
  const description =
    (settings['store_hero_subtitle_text'] as string) ||
    `Visitá la tienda de ${org.name} y explorá todos nuestros productos.`
  const pageUrl = `${SITE_URL}/${slug}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>

  <!-- Primary -->
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="es" />
  <meta property="og:site_name" content="${escapeHtml(title)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(pageUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  <!-- Redirect real browsers immediately -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}" />
  <script>window.location.replace(${JSON.stringify(pageUrl)})</script>
</head>
<body>
  <p>Redirigiendo a <a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache for 5 minutes — good enough for crawlers, short enough to reflect logo changes
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
