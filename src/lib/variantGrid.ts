/**
 * Lógica pura para la grilla editable de variantes (VariantGrid).
 *
 * La grilla acumula filas en memoria (existentes + nuevas) y recién persiste
 * todo junto con un solo "Guardar cambios". Estas funciones son las que
 * deciden qué se inserta, qué se actualiza y si hay errores de SKU antes de
 * pegarle a la base — todas puras para poder testearlas sin mockear Supabase.
 */

/** Fila de variante normalizada, con los mismos nombres de columna que `product_variants`. */
export interface VariantRowInput {
  id: string | null
  product_id: string
  sku: string
  name: string | null
  attributes: Record<string, string> | null
  price: number | null
  stock: number
  unit: string | null
  min_stock: number
  low_stock_threshold: number
  is_active: boolean
  image_url: string | null
}

export interface VariantBatchUpdate {
  id: string
  changes: Partial<Omit<VariantRowInput, 'id' | 'product_id'>>
}

export interface VariantBatchResult {
  inserts: Omit<VariantRowInput, 'id'>[]
  updates: VariantBatchUpdate[]
}

export interface VariantSkuError {
  key: string
  message: string
}

/** '' / solo espacios -> null; el resto se recorta. Mantiene consistente la comparación original vs. draft. */
export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** '' o no numérico -> null (nunca NaN). */
export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** Precio: negativo o inválido se trata como "sin override" (hereda el precio del producto). */
export function parseOptionalPrice(value: string): number | null {
  const parsed = parseOptionalNumber(value)
  if (parsed === null || parsed < 0) return null
  return parsed
}

/** Stock/mínimos/umbral: negativo o inválido cae al valor por defecto (nunca negativo). */
export function parseNonNegativeNumber(value: string, fallback = 0): number {
  const parsed = parseOptionalNumber(value)
  if (parsed === null || parsed < 0) return fallback
  return parsed
}

/**
 * Convierte el texto libre de la celda "Atributos" (ej: "color: Rojo, talle: M")
 * en un objeto. Pares sin ':' o con clave/valor vacío se ignoran. Sin pares
 * válidos -> null (mismo criterio que `attributes: Json | null` en la tabla).
 */
export function parseAttributesInput(text: string): Record<string, string> | null {
  const result: Record<string, string> = {}
  text.split(',').forEach((chunk) => {
    const sepIndex = chunk.indexOf(':')
    if (sepIndex === -1) return
    const key = chunk.slice(0, sepIndex).trim()
    const value = chunk.slice(sepIndex + 1).trim()
    if (!key || !value) return
    result[key] = value
  })
  return Object.keys(result).length > 0 ? result : null
}

/** Inversa de `parseAttributesInput`, para precargar la celda al editar una variante existente. */
export function formatAttributesValue(attributes: unknown): string {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return ''
  return Object.entries(attributes as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

function attributesEqual(a: Record<string, string> | null, b: Record<string, string> | null): boolean {
  const an = a && Object.keys(a).length > 0 ? a : null
  const bn = b && Object.keys(b).length > 0 ? b : null
  if (an === null && bn === null) return true
  if (an === null || bn === null) return false
  const aKeys = Object.keys(an).sort()
  const bKeys = Object.keys(bn).sort()
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key, index) => key === bKeys[index] && an[key] === bn[key])
}

/**
 * Valida SKUs de la grilla ANTES de tocar la base: vacíos y duplicados dentro
 * del propio draft (colisiones contra otra variante ya guardada en la DB las
 * devuelve Supabase — ese error se muestra tal cual en un toast).
 */
export function validateVariantSkus(rows: { key: string; sku: string }[]): VariantSkuError[] {
  const errors: VariantSkuError[] = []
  const keysByNormalizedSku = new Map<string, string[]>()

  rows.forEach((row, index) => {
    const trimmed = row.sku.trim()
    if (!trimmed) {
      errors.push({ key: row.key, message: `Fila ${index + 1}: el SKU no puede estar vacío` })
      return
    }
    const normalized = trimmed.toLowerCase()
    keysByNormalizedSku.set(normalized, [...(keysByNormalizedSku.get(normalized) ?? []), row.key])
  })

  keysByNormalizedSku.forEach((keys) => {
    if (keys.length <= 1) return
    const rowNumbers = keys
      .map((key) => rows.findIndex((row) => row.key === key) + 1)
      .filter((n) => n > 0)
    const sample = rows.find((row) => row.key === keys[0])?.sku.trim()
    keys.forEach((key) => {
      errors.push({
        key,
        message: `SKU "${sample}" repetido en las filas ${rowNumbers.join(', ')}`,
      })
    })
  })

  return errors
}

const COMPARABLE_FIELDS = [
  'sku',
  'name',
  'attributes',
  'price',
  'stock',
  'unit',
  'min_stock',
  'low_stock_threshold',
  'is_active',
  'image_url',
] as const

/**
 * Separa las filas de la grilla en inserts (sin `id`) y updates (con `id`,
 * solo si cambió algo respecto de `originalsById`). Filas sin cambios no
 * generan ningún update — así el botón "Guardar cambios" no reescribe filas
 * intactas.
 */
export function buildVariantBatch(
  rows: VariantRowInput[],
  originalsById: Map<string, VariantRowInput>
): VariantBatchResult {
  const inserts: Omit<VariantRowInput, 'id'>[] = []
  const updates: VariantBatchUpdate[] = []

  for (const row of rows) {
    if (!row.id) {
      inserts.push({
        product_id: row.product_id,
        sku: row.sku,
        name: row.name,
        attributes: row.attributes,
        price: row.price,
        stock: row.stock,
        unit: row.unit,
        min_stock: row.min_stock,
        low_stock_threshold: row.low_stock_threshold,
        is_active: row.is_active,
        image_url: row.image_url,
      })
      continue
    }

    const original = originalsById.get(row.id)
    if (!original) continue

    const changes: Partial<Omit<VariantRowInput, 'id' | 'product_id'>> = {}
    for (const field of COMPARABLE_FIELDS) {
      if (field === 'attributes') {
        if (!attributesEqual(row.attributes, original.attributes)) {
          changes.attributes = row.attributes
        }
        continue
      }
      if (row[field] !== original[field]) {
        // @ts-expect-error -- field es una de las claves numéricas/string ya acotadas por COMPARABLE_FIELDS
        changes[field] = row[field]
      }
    }

    if (Object.keys(changes).length > 0) {
      updates.push({ id: row.id, changes })
    }
  }

  return { inserts, updates }
}
