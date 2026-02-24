/**
 * Carga productos desde un CSV a una organización.
 *
 * Uso:
 *   node scripts/load-products-from-csv.js <organization_id|slug> [ruta_csv]
 *
 * Ejemplo por ID:
 *   node scripts/load-products-from-csv.js "550e8400-e29b-41d4-a716-446655440000"
 *
 * Ejemplo por slug:
 *   node scripts/load-products-from-csv.js org-lucas
 *
 * CSV esperado: primera línea puede ser "PRODUCTOS" (cabecera), luego una columna de nombres.
 * Líneas entre comillas si contienen comas.
 *
 * Requiere en .env:
 *   VITE_SUPABASE_URL (o SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CSV = join(__dirname, '..', 'productos_limpios.csv')
const BATCH_SIZE = 50
const DEFAULT_CATEGORY_NAME = 'General'
const DEFAULT_CATEGORY_SLUG = 'general'

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env')
    const content = readFileSync(envPath, 'utf-8')
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
    })
  } catch (_) {}
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function slugFromName(name, index) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'producto'
  return `${base}-${index}`
}

function parseCsvLines(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  const names = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (line.startsWith('"') && !line.endsWith('"')) {
      while (i + 1 < lines.length) {
        line += '\n' + lines[++i]
        if (line.endsWith('"')) break
      }
    }
    line = line.replace(/^"|"$/g, '').trim()
    if (!line) continue
    if (names.length === 0 && line.toUpperCase() === 'PRODUCTOS') continue
    names.push(line)
  }
  return names
}

async function main() {
  const orgArg = process.argv[2]
  const csvPath = process.argv[3] || DEFAULT_CSV

  if (!orgArg) {
    console.error('Uso: node scripts/load-products-from-csv.js <organization_id|slug> [ruta_csv]')
    console.error('Ejemplo: node scripts/load-products-from-csv.js org-lucas')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Faltan variables de entorno: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`)
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgArg)
  let organizationId = '8c331ff9-73aa-4882-aed8-66e23d5128d1'

  if (!organizationId) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', orgArg)
      .single()
    if (orgError || !org) {
      console.error(`❌ Organización no encontrada con slug/id: ${orgArg}`)
      process.exit(1)
    }
    organizationId = org.id
    console.log(`📌 Organización: ${org.name} (${orgArg})`)
  } else {
    const { data: org } = await supabase.from('organizations').select('id, name').eq('id', organizationId).single()
    if (org) console.log(`📌 Organización: ${org.name} (${organizationId})`)
  }

  let categoryId
  const { data: existingCat } = await supabase
    .from('categories')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('slug', DEFAULT_CATEGORY_SLUG)
    .maybeSingle()

  if (existingCat) {
    categoryId = existingCat.id
    console.log(`📁 Categoría existente: "${DEFAULT_CATEGORY_NAME}"`)
  } else {
    const { data: newCat, error: catError } = await supabase
      .from('categories')
      .insert({
        organization_id: organizationId,
        name: DEFAULT_CATEGORY_NAME,
        slug: DEFAULT_CATEGORY_SLUG,
      })
      .select('id')
      .single()
    if (catError) {
      console.error('❌ Error creando categoría:', catError.message)
      process.exit(1)
    }
    categoryId = newCat.id
    console.log(`📁 Categoría creada: "${DEFAULT_CATEGORY_NAME}"`)
  }

  const productNames = parseCsvLines(csvPath)
  console.log(`\n📄 Leyendo ${csvPath}: ${productNames.length} productos\n`)

  if (productNames.length === 0) {
    console.log('No hay filas para cargar.')
    process.exit(0)
  }

  let created = 0
  let errors = 0

  for (let i = 0; i < productNames.length; i += BATCH_SIZE) {
    const batch = productNames.slice(i, i + BATCH_SIZE)
    const rows = batch.map((name, j) => {
      const index = i + j
      return {
        organization_id: organizationId,
        category_id: categoryId,
        name,
        sku: slugFromName(name, index),
        price: 0,
        stock: 0,
        is_active: true,
        min_stock: 0,
        low_stock_threshold: 10,
      }
    })

    const { data, error } = await supabase.from('products').insert(rows).select('id')

    if (error) {
      if (error.code === '23505') {
        for (const row of rows) {
          const { error: singleError } = await supabase.from('products').insert(row).select('id').single()
          if (singleError) {
            console.error(`   ⚠️  "${row.name.slice(0, 40)}...": ${singleError.message}`)
            errors++
          } else {
            created++
          }
        }
      } else {
        console.error(`❌ Error en lote ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
        errors += batch.length
      }
    } else {
      created += data?.length ?? 0
    }

    const done = Math.min(i + BATCH_SIZE, productNames.length)
    process.stdout.write(`\r   Procesados: ${done}/${productNames.length}`)
  }

  console.log('\n')
  console.log(`✅ Creados: ${created}`)
  if (errors > 0) console.log(`⚠️  Errores: ${errors}`)
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
