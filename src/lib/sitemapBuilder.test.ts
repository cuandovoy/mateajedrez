import { describe, it, expect } from 'vitest'
import { buildSitemapXml } from './sitemapBuilder'

describe('buildSitemapXml', () => {
  it('genera el XML con header y urlset para una entrada completa', () => {
    const xml = buildSitemapXml([
      { loc: 'https://mateajedrez.uy/', lastmod: '2026-09-25', changefreq: 'daily', priority: 1 },
    ])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://mateajedrez.uy/</loc>')
    expect(xml).toContain('<lastmod>2026-09-25</lastmod>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).toContain('</urlset>')
  })

  it('omite lastmod, changefreq y priority cuando no se pasan', () => {
    const xml = buildSitemapXml([{ loc: 'https://mateajedrez.uy/products' }])
    expect(xml).toContain('<loc>https://mateajedrez.uy/products</loc>')
    expect(xml).not.toContain('<lastmod>')
    expect(xml).not.toContain('<changefreq>')
    expect(xml).not.toContain('<priority>')
  })

  it('escapa & en la URL', () => {
    const xml = buildSitemapXml([{ loc: 'https://mateajedrez.uy/products?a=1&b=2' }])
    expect(xml).toContain('<loc>https://mateajedrez.uy/products?a=1&amp;b=2</loc>')
  })

  it('escapa comillas y ángulos en la URL', () => {
    const xml = buildSitemapXml([{ loc: 'https://mateajedrez.uy/"<>\'' }])
    expect(xml).toContain('<loc>https://mateajedrez.uy/&quot;&lt;&gt;&apos;</loc>')
  })

  it('descarta entradas con loc vacío o solo espacios (dato sucio de Supabase no debe romper el sitemap)', () => {
    const xml = buildSitemapXml([{ loc: '' }, { loc: '   ' }, { loc: 'https://mateajedrez.uy/valid' }])
    expect(xml.match(/<url>/g)?.length).toBe(1)
    expect(xml).toContain('<loc>https://mateajedrez.uy/valid</loc>')
  })

  it('retorna un urlset vacío cuando no hay entradas (nunca debe tirar el build)', () => {
    const xml = buildSitemapXml([])
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('<url>')
  })

  it('genera un <url> por cada entrada, en el mismo orden', () => {
    const xml = buildSitemapXml([{ loc: 'https://mateajedrez.uy/a' }, { loc: 'https://mateajedrez.uy/b' }])
    const indexA = xml.indexOf('<loc>https://mateajedrez.uy/a</loc>')
    const indexB = xml.indexOf('<loc>https://mateajedrez.uy/b</loc>')
    expect(indexA).toBeGreaterThan(-1)
    expect(indexB).toBeGreaterThan(indexA)
  })

  it('formatea priority con un decimal', () => {
    const xml = buildSitemapXml([{ loc: 'https://mateajedrez.uy/', priority: 0.7 }])
    expect(xml).toContain('<priority>0.7</priority>')
  })
})
