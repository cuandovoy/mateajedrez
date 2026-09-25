// Builders puros de datos estructurados (JSON-LD / schema.org). No dependen de
// React ni de Supabase — reciben datos ya resueltos por el componente y
// devuelven el objeto listo para `JSON.stringify` dentro de un
// <script type="application/ld+json">.

export type ProductAvailability = 'InStock' | 'OutOfStock'

export interface ProductJsonLdInput {
  name: string
  description?: string | null
  images: string[]
  sku?: string | null
  url: string
  price: number
  priceCurrency: string
  availability: ProductAvailability
}

export interface ProductJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Product'
  name: string
  description?: string
  image?: string[]
  sku?: string
  url: string
  offers: {
    '@type': 'Offer'
    url: string
    price: string
    priceCurrency: string
    availability: string
  }
}

/**
 * Arma el bloque `Product` + `Offer` para la página de detalle de producto.
 * `price` siempre viene ya resuelto por el llamador con `getEffectivePrice`
 * (precio con descuento aplicado, ver CLAUDE.md) — este builder no conoce
 * reglas de descuento, solo formatea.
 */
export function buildProductJsonLd(input: ProductJsonLdInput): ProductJsonLd {
  const jsonLd: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: input.url,
    offers: {
      '@type': 'Offer',
      url: input.url,
      price: input.price.toFixed(2),
      priceCurrency: input.priceCurrency,
      availability: `https://schema.org/${input.availability}`,
    },
  }

  const description = input.description?.trim()
  if (description) jsonLd.description = description

  if (input.images.length > 0) jsonLd.image = input.images

  const sku = input.sku?.trim()
  if (sku) jsonLd.sku = sku

  return jsonLd
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export interface BreadcrumbJsonLd {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

/** Arma el bloque `BreadcrumbList` a partir de la misma migas de pan visual ya calculada por la página. */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): BreadcrumbJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
