/** Storefront shows a "low stock" badge when stock is between 1 and this value. */
export const LOW_STOCK_BADGE_MAX = 3

export interface GalleryImageInput {
  image_url: string | null
  display_order: number
  is_primary?: boolean | null
}

export type VariantImageResolution =
  | { kind: 'keep' }
  | { kind: 'index'; index: number }
  | { kind: 'override'; url: string }

export interface StockBadge {
  kind: 'out' | 'low'
  label: string
}

export function isValidImageUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false
  if (!url.trim()) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Stable, de-duplicated list of product image URLs: primary first, then display order, then legacy url. */
export function buildImageUrls(
  productImages: GalleryImageInput[] | null | undefined,
  legacyUrl: string | null | undefined
): string[] {
  const urls: string[] = []
  const sorted = [...(productImages ?? [])]
    .filter((img) => isValidImageUrl(img.image_url))
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return a.display_order - b.display_order
    })
  for (const img of sorted) {
    if (img.image_url && !urls.includes(img.image_url)) urls.push(img.image_url)
  }
  if (isValidImageUrl(legacyUrl) && !urls.includes(legacyUrl)) urls.push(legacyUrl)
  return urls
}

/**
 * Decides how selecting a variant affects the main image without altering the gallery list:
 * jump to it if it is already in the gallery, override the main image otherwise, keep if none.
 */
export function resolveVariantImage(
  imageUrls: string[],
  variantImageUrl: string | null | undefined
): VariantImageResolution {
  if (!isValidImageUrl(variantImageUrl)) return { kind: 'keep' }
  const index = imageUrls.indexOf(variantImageUrl)
  if (index >= 0) return { kind: 'index', index }
  return { kind: 'override', url: variantImageUrl }
}

/** Badge shown on product cards: only for out-of-stock or low stock, never for normal stock. */
export function getStockBadge(stock: number | null): StockBadge | null {
  if (stock === null) return null
  if (stock <= 0) return { kind: 'out', label: 'Sin stock' }
  if (stock === 1) return { kind: 'low', label: 'Última unidad' }
  if (stock <= LOW_STOCK_BADGE_MAX) return { kind: 'low', label: `Últimas ${stock}` }
  return null
}
