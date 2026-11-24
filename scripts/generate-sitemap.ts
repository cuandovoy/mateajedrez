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
 * Fail-safe por diseño: si faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY /
 * VITE_STORE_SLUG, o si cualquier consulta a Supabase falla (red, RLS, org
 * inactiva, etc.), se loguea un warning y se deja `public/sitemap.xml` tal cual
 * está (nunca se pisa con una versión degradada) — y nunca se rompe `yarn build`.
 * Se escribe en `public/` (no en `dist/`) porque Vite vacía `dist/` y luego copia
 * `public/` al build: el prebuild corre antes, así que `public/` es el único
 * destino que termina en la imagen.
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
import { buildSitemapXml, toSitemapDate } from '../src/lib/sitemapBuilder.ts'
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
  { path: '/visitanos', changefreq: 'monthly', priority: 0.5 },
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

// Retorna null cuando no se pudo obtener el catálogo completo: el caller NO debe escribir nada.
async function fetchDynamicEntries(siteUrl: string): Promise<SitemapEntry[] | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const storeSlug = process.env.VITE_STORE_SLUG

  if (!supabaseUrl || !supabaseAnonKey || !storeSlug) {
    console.warn(
      '[generate-sitemap] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_STORE_SLUG en el entorno de build — ' +
        'public/sitemap.xml queda sin cambios.'
    )
    return null
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: orgData, error: orgError } = await supabase.rpc('get_org_by_slug', { p_slug: storeSlug })
    const org = (Array.isArray(orgData) ? orgData[0] : orgData) as { id?: string } | null | undefined

    if (orgError || !org?.id) {
      console.warn(
        '[generate-sitemap] No se pudo resolver la organización desde VITE_STORE_SLUG — public/sitemap.xml queda sin cambios.',
        orgError?.message ?? 'sin datos'
      )
      return null
    }
    const organizationId = org.id

    // Mismo filtro que usePublicProducts.ts / usePublicCategories.ts: productos
    // activos y visibles en la tienda; categorías no tienen flag de visibilidad
    // propio, todas las de la organización son públicas.
    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('visible_in_store', true),
      supabase.from('categories').select('slug, updated_at').eq('organization_id', organizationId),
    ])

    // Un sitemap sin productos o sin categorías por un error transitorio sería peor que
    // el anterior: ante cualquier error se aborta y se conserva el archivo existente.
    if (productsResult.error || categoriesResult.error) {
      console.warn(
        '[generate-sitemap] Error consultando productos/categorías — public/sitemap.xml queda sin cambios:',
        productsResult.error?.message ?? categoriesResult.error?.message
      )
      return null
    }

    const products = (productsResult.data ?? []) as ProductRow[]
    const categories = (categoriesResult.data ?? []) as CategoryRow[]

    const categoryEntries: SitemapEntry[] = categories
      .filter((c) => !!c.slug)
      .map((c) => ({
        loc: buildAbsoluteUrl(`/categories/${c.slug}`, siteUrl),
        lastmod: toSitemapDate(c.updated_at),
        changefreq: 'weekly',
        priority: 0.7,
      }))

    const productEntries: SitemapEntry[] = products
      .filter((p) => !!p.id)
      .map((p) => ({
        loc: buildAbsoluteUrl(`/product/${p.id}`, siteUrl),
        lastmod: toSitemapDate(p.updated_at),
        changefreq: 'weekly',
        priority: 0.6,
      }))

    return [...categoryEntries, ...productEntries]
  } catch (err) {
    console.warn('[generate-sitemap] Error inesperado consultando Supabase — public/sitemap.xml queda sin cambios:', err)
    return null
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
  if (dynamicEntries === null) return
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
    '[generate-sitemap] Error inesperado generando el sitemap — public/sitemap.xml queda sin cambios:',
    err
  )
})
