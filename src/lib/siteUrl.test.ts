import { describe, it, expect } from 'vitest'
import { buildAbsoluteUrl, DEFAULT_SITE_URL } from './siteUrl'

// buildAbsoluteUrl es lógica pura, sin dependencia del entorno — usada tanto
// por componentes React (canonical/og:url) como por el script de generación
// del sitemap (Node puro, sin `import.meta.env`). Los tests de `getSiteUrl` y
// `absoluteUrl` (que sí leen `VITE_SITE_URL`) viven en `siteUrl.env.test.ts`:
// necesitan importar el módulo dinámicamente para que `vi.stubEnv` surta
// efecto, y este archivo no puede tener un import estático de `./siteUrl`
// sin romper ese aislamiento (ver comentario en ese archivo).

describe('buildAbsoluteUrl', () => {
  it('concatena base y path con un solo slash', () => {
    expect(buildAbsoluteUrl('/product/123', 'https://mateajedrez.uy')).toBe('https://mateajedrez.uy/product/123')
  })

  it('agrega el slash inicial al path si falta', () => {
    expect(buildAbsoluteUrl('product/123', 'https://mateajedrez.uy')).toBe('https://mateajedrez.uy/product/123')
  })

  it('quita el slash final de la base para evitar doble slash', () => {
    expect(buildAbsoluteUrl('/products', 'https://mateajedrez.uy/')).toBe('https://mateajedrez.uy/products')
  })

  it('usa "/" cuando el path está vacío', () => {
    expect(buildAbsoluteUrl('', 'https://mateajedrez.uy')).toBe('https://mateajedrez.uy/')
  })

  it('usa DEFAULT_SITE_URL cuando no se pasa baseUrl', () => {
    expect(buildAbsoluteUrl('/products')).toBe(`${DEFAULT_SITE_URL}/products`)
  })

  it('usa DEFAULT_SITE_URL cuando baseUrl es un string vacío', () => {
    expect(buildAbsoluteUrl('/products', '')).toBe(`${DEFAULT_SITE_URL}/products`)
  })

  it('preserva query params y hash del path', () => {
    expect(buildAbsoluteUrl('/products?search=mate#top', 'https://mateajedrez.uy')).toBe(
      'https://mateajedrez.uy/products?search=mate#top'
    )
  })
})
