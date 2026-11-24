export interface SitemapEntry {
  loc: string
  lastmod?: string | null
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'
const URLSET_OPEN = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
const URLSET_CLOSE = '</urlset>'

/**
 * Escapa los cinco caracteres especiales de XML. `loc` puede contener `&`
 * (ej. una URL con query string) y romper el documento si no se escapa.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Construye el XML de `sitemap.xml` a partir de una lista de entradas.
 * Entradas con `loc` vacío o solo espacios se descartan silenciosamente —
 * un dato sucio proveniente de Supabase (ej. un producto con id nulo) nunca
 * debe tumbar la generación del sitemap ni el build.
 */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const seen = new Set<string>()
  const validEntries = entries.filter((entry) => {
    const loc = entry.loc?.trim()
    if (!loc || seen.has(loc)) return false
    seen.add(loc)
    return true
  })

  const urlNodes = validEntries.map((entry) => {
    const fields = [`    <loc>${escapeXml(entry.loc.trim())}</loc>`]
    if (entry.lastmod) fields.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
    if (entry.changefreq) fields.push(`    <changefreq>${entry.changefreq}</changefreq>`)
    if (typeof entry.priority === 'number') fields.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
    return `  <url>\n${fields.join('\n')}\n  </url>`
  })

  return [XML_HEADER, URLSET_OPEN, ...urlNodes, URLSET_CLOSE, ''].join('\n')
}

/**
 * Normaliza un timestamp (ej. `updated_at` de Supabase) al formato `YYYY-MM-DD`
 * que acepta `<lastmod>`. Retorna undefined si el valor falta o no es una fecha válida.
 */
export function toSitemapDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined
  const parsed = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return undefined
  return day
}
