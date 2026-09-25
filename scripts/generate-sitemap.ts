#!/usr/bin/env node
/**
 * Genera `public/sitemap.xml` antes de `vite build` (hook `prebuild` en
 * package.json, corre automáticamente antes de `yarn build`).
 *
 * Corre con Node nativo (soporte de TypeScript sin transpilar, Node >=22.6),
 * no con Vite — por eso lee `process.env` directamente en vez de
 * `import.meta.env`, y solo importa la lógica PURA de `src/lib/` (sin nada
 * que dependa de Vite/React).
 *
 * Fail-soft por diseño: si faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY /
 * VITE_STORE_SLUG, o si la consulta a Supabase falla (red, RLS, org inactiva,
 * etc.), igual se escribe un sitemap válido con las rutas estáticas — nunca
 * debe romper `yarn build`.
 *
 * Tradeoff conocido (ver CHANGELOG.md 2026-09-25): el sitemap se genera en
 * build-time, no en request-time. Un producto nuevo cargado en Supabase
 * después del último deploy no aparece en el sitemap hasta el próximo
 * build/deploy.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildSitemapXml } from '../src/lib/sitemapBuilder.ts'
import type { SitemapEntry } from '../src/lib/sitemapBuilder.ts'
import { buildAbsoluteUrl, DEFAULT_SITE_URL } from '../src/lib/siteUrl.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Mismo patrón que scripts/generate-types.js y scripts/seed-organizations.js:
// solo completa variables que no estén ya en process.env, así el ARG/ENV de
// Docker (o cualquier env real de CI) siempre gana sobre el .env local.
function loadDotEnvFallback(): void {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return
  try {
    const content = readFileSync(envPath, 'utf-8')
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eq = trimmed.indexOf('=')
      if (eq <= 0) return
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    })
  } catch {
    // Sin .env local legible (build de CI/Docker) — no es un error, se sigue con process.env tal cual.
  }
}

const STATIC_ROUTES: Array<{ path: string; changefreq: NonNullable<SitemapEntry['changefreq']>; priority: number }> = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/products', changefreq: 'daily', priority: 0.9 },
  { path: '/legal/privacidad', changefreq: 'yearly', priority: 0.2 },
  { path: '/legal/terminos', changefreq: 'yearly', priority: 0.2 },
]

interface ProductRow {
  id: string
  updated_at: string | null
}

interface CategoryRow {
  slug: string
  updated_at: string | null
}

async function fetchDynamicEntries(siteUrl: string): Promise<SitemapEntry[]> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const storeSlug = process.env.VITE_STORE_SLUG

  if (!supabaseUrl || !supabaseAnonKey || !storeSlug) {
    console.warn(
      '[generate-sitemap] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_STORE_SLUG en el entorno de build — ' +
        'se genera el sitemap solo con rutas estáticas.'
    )
    return []
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: orgData, error: orgError } = await supabase.rpc('get_org_by_slug', { p_slug: storeSlug })
    const org = (Array.isArray(orgData) ? orgData[0] : orgData) as { id?: string } | null | undefined

    if (orgError || !org?.id) {
      console.warn(
        '[generate-sitemap] No se pudo resolver la organización desde VITE_STORE_SLUG — se continúa solo con rutas estáticas.',
        orgError?.message ?? 'sin datos'
      )
      return []
    }
    const organizationId = org.id

    // Mismo filtro que usePublicProducts.ts / usePublicCategories.ts: productos
    // activos de la organización; categorías no tienen flag de visibilidad propio,
    // todas las de la organización son públicas.
    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true),
      supabase.from('categories').select('slug, updated_at').eq('organization_id', organizationId),
    ])

    if (productsResult.error) {
      console.warn('[generate-sitemap] Error consultando productos, se omiten del sitemap:', productsResult.error.message)
    }
    if (categoriesResult.error) {
      console.warn('[generate-sitemap] Error consultando categorías, se omiten del sitemap:', categoriesResult.error.message)
    }

    const products = (productsResult.data ?? []) as ProductRow[]
    const categories = (categoriesResult.data ?? []) as CategoryRow[]

    const categoryEntries: SitemapEntry[] = categories
      .filter((c) => !!c.slug)
      .map((c) => ({
        loc: buildAbsoluteUrl(`/categories/${c.slug}`, siteUrl),
        lastmod: c.updated_at ? c.updated_at.slice(0, 10) : undefined,
        changefreq: 'weekly',
        priority: 0.7,
      }))

    const productEntries: SitemapEntry[] = products
      .filter((p) => !!p.id)
      .map((p) => ({
        loc: buildAbsoluteUrl(`/product/${p.id}`, siteUrl),
        lastmod: p.updated_at ? p.updated_at.slice(0, 10) : undefined,
        changefreq: 'weekly',
        priority: 0.6,
      }))

    return [...categoryEntries, ...productEntries]
  } catch (err) {
    console.warn('[generate-sitemap] Error inesperado consultando Supabase — se continúa solo con rutas estáticas:', err)
    return []
  }
}

async function main(): Promise<void> {
  loadDotEnvFallback()
  const siteUrl = process.env.VITE_SITE_URL?.trim() || DEFAULT_SITE_URL

  const staticEntries: SitemapEntry[] = STATIC_ROUTES.map((route) => ({
    loc: buildAbsoluteUrl(route.path, siteUrl),
    changefreq: route.changefreq,
    priority: route.priority,
  }))

  const dynamicEntries = await fetchDynamicEntries(siteUrl)
  const xml = buildSitemapXml([...staticEntries, ...dynamicEntries])

  const outPath = join(rootDir, 'public', 'sitemap.xml')
  writeFileSync(outPath, xml, 'utf-8')
  console.log(
    `[generate-sitemap] sitemap.xml generado con ${staticEntries.length + dynamicEntries.length} URLs (${staticEntries.length} estáticas, ${dynamicEntries.length} dinámicas) → ${outPath}`
  )
}

main().catch((err) => {
  // Fail-soft: ni siquiera un error no previsto en main() debe tumbar `yarn build`.
  console.error(
    '[generate-sitemap] Error inesperado generando el sitemap — se continúa el build sin sitemap.xml actualizado:',
    err
  )
})
