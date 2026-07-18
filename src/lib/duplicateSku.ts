/**
 * Genera un SKU sugerido para "Duplicar producto" agregando el sufijo `-copia`,
 * evitando colisión con los SKUs ya existentes (SKU único por organización en
 * `products`, y único por producto en `product_variants`).
 *
 * Si `-copia` ya está en uso, prueba `-copia-2`, `-copia-3`, etc. hasta encontrar
 * el primer sufijo libre (no necesariamente el mayor: si `-copia-2` está libre pero
 * `-copia-3` ya existe, devuelve `-copia-2`).
 *
 * La comparación es sensible a mayúsculas/minúsculas, igual que el índice único
 * de Postgres sobre una columna VARCHAR con la collation por defecto.
 */
export function generateDuplicateSku(baseSku: string, existingSkus: string[]): string {
  const trimmedBase = (baseSku ?? '').trim()
  if (!trimmedBase) return ''

  const existing = new Set((existingSkus ?? []).map((sku) => sku.trim()))

  const candidate = `${trimmedBase}-copia`
  if (!existing.has(candidate)) return candidate

  let suffix = 2
  let next = `${candidate}-${suffix}`
  while (existing.has(next)) {
    suffix += 1
    next = `${candidate}-${suffix}`
  }
  return next
}
