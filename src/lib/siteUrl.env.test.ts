import { describe, it, expect, vi, afterEach } from 'vitest'

// IMPORTANTE: este archivo NO debe tener un import estático de `./siteUrl`.
// Vite/Vitest resuelve `import.meta.env.VITE_SITE_URL` en tiempo de
// transformación del módulo; un módulo ya cargado (estática o dinámicamente,
// una vez) queda con ese valor fijo para el resto del proceso, y
// `vi.stubEnv` posterior no lo actualiza retroactivamente. Por eso cada test
// llama `vi.resetModules()` y vuelve a importar `./siteUrl` dinámicamente
// DESPUÉS de `vi.stubEnv`, para forzar una transformación nueva que sí vea
// el valor stubbeado.
const DEFAULT_SITE_URL = 'https://ruemia.uy'

async function loadSiteUrlModule() {
  vi.resetModules()
  return import('./siteUrl')
}

describe('getSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('retorna VITE_SITE_URL si está definida', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://custom.example.com')
    const { getSiteUrl } = await loadSiteUrlModule()
    expect(getSiteUrl()).toBe('https://custom.example.com')
  })

  it('quita el slash final de VITE_SITE_URL', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://custom.example.com/')
    const { getSiteUrl } = await loadSiteUrlModule()
    expect(getSiteUrl()).toBe('https://custom.example.com')
  })

  it('retorna DEFAULT_SITE_URL cuando VITE_SITE_URL es un string vacío', async () => {
    vi.stubEnv('VITE_SITE_URL', '')
    const { getSiteUrl } = await loadSiteUrlModule()
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
  })

  it('retorna DEFAULT_SITE_URL cuando VITE_SITE_URL es solo espacios', async () => {
    vi.stubEnv('VITE_SITE_URL', '   ')
    const { getSiteUrl } = await loadSiteUrlModule()
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
  })
})

describe('absoluteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('usa DEFAULT_SITE_URL cuando VITE_SITE_URL no está configurada', async () => {
    vi.stubEnv('VITE_SITE_URL', '')
    const { absoluteUrl } = await loadSiteUrlModule()
    expect(absoluteUrl('/product/1')).toBe(`${DEFAULT_SITE_URL}/product/1`)
  })

  it('respeta VITE_SITE_URL cuando está configurada', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://staging.ruemia.uy')
    const { absoluteUrl } = await loadSiteUrlModule()
    expect(absoluteUrl('/product/1')).toBe('https://staging.ruemia.uy/product/1')
  })
})
