import { describe, it, expect } from 'vitest'
import { buildProductJsonLd, buildBreadcrumbJsonLd } from './jsonLd'

describe('buildProductJsonLd', () => {
  const base = {
    name: 'ELLEN',
    images: ['https://cdn.example.com/ellen.jpg'],
    url: 'https://mateajedrez.uy/product/123',
    price: 1500,
    priceCurrency: 'UYU',
    availability: 'InStock' as const,
  }

  it('genera el bloque Product con offers en el caso feliz', () => {
    const jsonLd = buildProductJsonLd({ ...base, description: 'Matera artesanal', sku: 'SKU-1' })
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Product')
    expect(jsonLd.name).toBe('ELLEN')
    expect(jsonLd.image).toEqual(['https://cdn.example.com/ellen.jpg'])
    expect(jsonLd.sku).toBe('SKU-1')
    expect(jsonLd.description).toBe('Matera artesanal')
    expect(jsonLd.url).toBe(base.url)
    expect(jsonLd.offers['@type']).toBe('Offer')
    expect(jsonLd.offers.price).toBe('1500.00')
    expect(jsonLd.offers.priceCurrency).toBe('UYU')
    expect(jsonLd.offers.availability).toBe('https://schema.org/InStock')
    expect(jsonLd.offers.url).toBe(base.url)
  })

  it('marca OutOfStock en la disponibilidad cuando el stock real es 0', () => {
    const jsonLd = buildProductJsonLd({ ...base, availability: 'OutOfStock' })
    expect(jsonLd.offers.availability).toBe('https://schema.org/OutOfStock')
  })

  it('omite description cuando no se pasa', () => {
    const jsonLd = buildProductJsonLd(base)
    expect(jsonLd.description).toBeUndefined()
  })

  it('omite description cuando es solo espacios (no genera un campo vacío inútil)', () => {
    const jsonLd = buildProductJsonLd({ ...base, description: '   ' })
    expect(jsonLd.description).toBeUndefined()
  })

  it('omite sku cuando no se pasa', () => {
    const jsonLd = buildProductJsonLd(base)
    expect(jsonLd.sku).toBeUndefined()
  })

  it('omite sku cuando es solo espacios', () => {
    const jsonLd = buildProductJsonLd({ ...base, sku: '   ' })
    expect(jsonLd.sku).toBeUndefined()
  })

  it('omite image cuando la lista de imágenes está vacía (producto sin fotos cargadas)', () => {
    const jsonLd = buildProductJsonLd({ ...base, images: [] })
    expect(jsonLd.image).toBeUndefined()
  })

  it('redondea el precio a dos decimales', () => {
    const jsonLd = buildProductJsonLd({ ...base, price: 99.999 })
    expect(jsonLd.offers.price).toBe('100.00')
  })

  it('formatea un precio entero con dos decimales (formato esperado por Rich Results)', () => {
    const jsonLd = buildProductJsonLd({ ...base, price: 100 })
    expect(jsonLd.offers.price).toBe('100.00')
  })
})

describe('buildBreadcrumbJsonLd', () => {
  it('genera un ListItem por cada elemento, con posición secuencial desde 1', () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: 'Inicio', url: 'https://mateajedrez.uy/' },
      { name: 'Materas', url: 'https://mateajedrez.uy/categories/materas' },
      { name: 'Ellen', url: 'https://mateajedrez.uy/product/123' },
    ])
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('BreadcrumbList')
    expect(jsonLd.itemListElement).toHaveLength(3)
    expect(jsonLd.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Inicio',
      item: 'https://mateajedrez.uy/',
    })
    expect(jsonLd.itemListElement[2].position).toBe(3)
  })

  it('retorna un itemListElement vacío para una lista vacía (no rompe el render)', () => {
    const jsonLd = buildBreadcrumbJsonLd([])
    expect(jsonLd.itemListElement).toEqual([])
  })

  it('genera un solo ListItem para breadcrumbs de un nivel (home sin categoría)', () => {
    const jsonLd = buildBreadcrumbJsonLd([{ name: 'Inicio', url: 'https://mateajedrez.uy/' }])
    expect(jsonLd.itemListElement).toHaveLength(1)
    expect(jsonLd.itemListElement[0].position).toBe(1)
  })
})
