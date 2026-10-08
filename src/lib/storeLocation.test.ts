import { describe, it, expect } from 'vitest'
import {
  STORE_ADDRESS,
  buildMapEmbedUrl,
  buildDirectionsUrl,
  buildWhatsappUrl,
} from './storeLocation'

const ENCODED = 'Avenida%20Espa%C3%B1a%201471%2C%20Paysand%C3%BA%2C%20Uruguay'

describe('STORE_ADDRESS', () => {
  it('contiene la dirección confirmada del local', () => {
    expect(STORE_ADDRESS).toBe('Avenida España 1471, Paysandú, Uruguay')
  })
})

describe('buildMapEmbedUrl', () => {
  it('construye la URL de embed sin API key con la dirección codificada', () => {
    expect(buildMapEmbedUrl(STORE_ADDRESS)).toBe(`https://www.google.com/maps?q=${ENCODED}&output=embed`)
  })

  it('codifica caracteres reservados como & y # para no romper la query', () => {
    const url = buildMapEmbedUrl('Calle A & B #12')
    expect(url).toContain('q=Calle%20A%20%26%20B%20%2312')
    expect(url.endsWith('&output=embed')).toBe(true)
  })

  it('ignora espacios al inicio y al final', () => {
    expect(buildMapEmbedUrl(`  ${STORE_ADDRESS}  `)).toBe(buildMapEmbedUrl(STORE_ADDRESS))
  })

  it('retorna cadena vacía para dirección vacía', () => {
    expect(buildMapEmbedUrl('')).toBe('')
    expect(buildMapEmbedUrl('   ')).toBe('')
  })
})

describe('buildDirectionsUrl', () => {
  it('construye la URL de "Cómo llegar" con la dirección como destino', () => {
    expect(buildDirectionsUrl(STORE_ADDRESS)).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${ENCODED}`
    )
  })

  it('codifica caracteres reservados en el destino', () => {
    expect(buildDirectionsUrl('A&B')).toContain('destination=A%26B')
  })

  it('retorna cadena vacía para dirección vacía', () => {
    expect(buildDirectionsUrl('')).toBe('')
    expect(buildDirectionsUrl('  ')).toBe('')
  })
})

describe('buildWhatsappUrl', () => {
  it('construye el link wa.me dejando solo dígitos', () => {
    expect(buildWhatsappUrl('+598 99 123 456')).toBe('https://wa.me/59899123456')
  })

  it('retorna null para undefined', () => {
    expect(buildWhatsappUrl(undefined)).toBeNull()
  })

  it('retorna null para null', () => {
    expect(buildWhatsappUrl(null)).toBeNull()
  })

  it('retorna null para cadena vacía o solo espacios', () => {
    expect(buildWhatsappUrl('')).toBeNull()
    expect(buildWhatsappUrl('   ')).toBeNull()
  })

  it('retorna null si el valor no contiene ningún dígito', () => {
    expect(buildWhatsappUrl('abc-+')).toBeNull()
  })
})
