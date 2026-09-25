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
  const validEntries = entries.filter((entry) => !!entry.loc && entry.loc.trim() !== '')

  const urlNodes = validEntries.map((entry) => {
    const fields = [`    <loc>${escapeXml(entry.loc)}</loc>`]
    if (entry.lastmod) fields.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
    if (entry.changefreq) fields.push(`    <changefreq>${entry.changefreq}</changefreq>`)
    if (typeof entry.priority === 'number') fields.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
    return `  <url>\n${fields.join('\n')}\n  </url>`
  })

  return [XML_HEADER, URLSET_OPEN, ...urlNodes, URLSET_CLOSE, ''].join('\n')
}
