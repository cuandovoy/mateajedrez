import { describe, it, expect } from 'vitest'
import { buildImageUrls, resolveVariantImage, getStockBadge, LOW_STOCK_BADGE_MAX } from './productGallery'

const img = (image_url: string | null, display_order = 0, is_primary = false) => ({
  image_url,
  display_order,
  is_primary,
})

describe('buildImageUrls', () => {
  it('ordena primaria primero y luego por display_order', () => {
    const urls = buildImageUrls(
      [img('https://a/2.jpg', 2), img('https://a/1.jpg', 1), img('https://a/p.jpg', 5, true)],
      null
    )
    expect(urls).toEqual(['https://a/p.jpg', 'https://a/1.jpg', 'https://a/2.jpg'])
  })

  it('descarta urls inválidas, vacías y null', () => {
    expect(buildImageUrls([img(null), img(''), img('  '), img('ftp://x/y.jpg'), img('no-url')], null)).toEqual([])
  })

  it('agrega la url legacy al final si no está repetida', () => {
    expect(buildImageUrls([img('https://a/1.jpg')], 'https://a/legacy.jpg')).toEqual([
      'https://a/1.jpg',
      'https://a/legacy.jpg',
    ])
    expect(buildImageUrls([img('https://a/1.jpg')], 'https://a/1.jpg')).toEqual(['https://a/1.jpg'])
  })

  it('retorna lista vacía con undefined/null y sin legacy', () => {
    expect(buildImageUrls(undefined, undefined)).toEqual([])
    expect(buildImageUrls(null, null)).toEqual([])
  })
})

describe('resolveVariantImage', () => {
  const urls = ['https://a/1.jpg', 'https://a/2.jpg']

  it('salta al índice si la imagen de la variante ya está en la galería', () => {
    expect(resolveVariantImage(urls, 'https://a/2.jpg')).toEqual({ kind: 'index', index: 1 })
  })

  it('usa override de la imagen principal si la variante tiene una imagen que no está en la galería', () => {
    expect(resolveVariantImage(urls, 'https://a/v.jpg')).toEqual({ kind: 'override', url: 'https://a/v.jpg' })
  })

  it('mantiene la imagen actual si la variante no tiene imagen (null, undefined, vacía)', () => {
    expect(resolveVariantImage(urls, null)).toEqual({ kind: 'keep' })
    expect(resolveVariantImage(urls, undefined)).toEqual({ kind: 'keep' })
    expect(resolveVariantImage(urls, '')).toEqual({ kind: 'keep' })
  })

  it('mantiene la imagen actual si la url de la variante es inválida', () => {
    expect(resolveVariantImage(urls, 'not-a-url')).toEqual({ kind: 'keep' })
  })

  it('usa override cuando la galería está vacía', () => {
    expect(resolveVariantImage([], 'https://a/v.jpg')).toEqual({ kind: 'override', url: 'https://a/v.jpg' })
  })
})

describe('getStockBadge', () => {
  it('no muestra badge mientras el stock es desconocido (null)', () => {
    expect(getStockBadge(null)).toBeNull()
  })

  it('muestra "Sin stock" con 0 y con valores negativos', () => {
    expect(getStockBadge(0)).toEqual({ kind: 'out', label: 'Sin stock' })
    expect(getStockBadge(-2)).toEqual({ kind: 'out', label: 'Sin stock' })
  })

  it('muestra "Últimas N" en el límite superior (umbral)', () => {
    expect(getStockBadge(LOW_STOCK_BADGE_MAX)).toEqual({ kind: 'low', label: `Últimas ${LOW_STOCK_BADGE_MAX}` })
  })

  it('muestra "Última unidad" con stock 1', () => {
    expect(getStockBadge(1)).toEqual({ kind: 'low', label: 'Última unidad' })
  })

  it('no muestra badge con stock por encima del umbral (umbral + 1)', () => {
    expect(getStockBadge(LOW_STOCK_BADGE_MAX + 1)).toBeNull()
    expect(getStockBadge(100)).toBeNull()
  })
})
