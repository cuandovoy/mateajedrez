import { describe, it, expect } from 'vitest'
import { capitalizeFirst, formatPrice, formatDateShort, normalizeLineBreaks, translateAttributeLabel } from './utils'
import type { OrganizationSettings } from '@/types/database.types'

// ─── capitalizeFirst ─────────────────────────────────────────────────────────

describe('capitalizeFirst', () => {
  it('capitaliza la primera letra', () => {
    expect(capitalizeFirst('hola mundo')).toBe('Hola mundo')
  })

  it('no toca el resto del string', () => {
    expect(capitalizeFirst('hOLA')).toBe('HOLA')
  })

  it('retorna vacío para string vacío', () => {
    expect(capitalizeFirst('')).toBe('')
  })

  it('retorna vacío para null', () => {
    expect(capitalizeFirst(null)).toBe('')
  })

  it('retorna vacío para undefined', () => {
    expect(capitalizeFirst(undefined)).toBe('')
  })

  it('maneja un solo caracter', () => {
    expect(capitalizeFirst('a')).toBe('A')
  })
})

// ─── normalizeLineBreaks ─────────────────────────────────────────────────────

describe('normalizeLineBreaks', () => {
  it('convierte \\n literal a salto de línea real', () => {
    expect(normalizeLineBreaks('Línea 1\\n\\nLínea 2')).toBe('Línea 1\n\nLínea 2')
  })

  it('convierte \\r\\n literal a salto de línea real', () => {
    expect(normalizeLineBreaks('Línea 1\\r\\nLínea 2')).toBe('Línea 1\nLínea 2')
  })

  it('no toca un salto de línea real ya existente', () => {
    expect(normalizeLineBreaks('Línea 1\nLínea 2')).toBe('Línea 1\nLínea 2')
  })

  it('deja intacto un string sin saltos de línea', () => {
    expect(normalizeLineBreaks('Sin saltos')).toBe('Sin saltos')
  })

  it('retorna vacío para string vacío', () => {
    expect(normalizeLineBreaks('')).toBe('')
  })

  it('retorna vacío para null', () => {
    expect(normalizeLineBreaks(null)).toBe('')
  })

  it('retorna vacío para undefined', () => {
    expect(normalizeLineBreaks(undefined)).toBe('')
  })
})

// ─── translateAttributeLabel ─────────────────────────────────────────────────

describe('translateAttributeLabel', () => {
  it('traduce "Size" a "Talle"', () => {
    expect(translateAttributeLabel('Size')).toBe('Talle')
  })

  it('traduce "size" en minúscula a "Talle"', () => {
    expect(translateAttributeLabel('size')).toBe('Talle')
  })

  it('normaliza "talle" a "Talle"', () => {
    expect(translateAttributeLabel('talle')).toBe('Talle')
  })

  it('normaliza "color" a "Color"', () => {
    expect(translateAttributeLabel('color')).toBe('Color')
  })

  it('traduce "Colour" a "Color"', () => {
    expect(translateAttributeLabel('Colour')).toBe('Color')
  })

  it('capitaliza claves no reconocidas en vez de traducirlas', () => {
    expect(translateAttributeLabel('material')).toBe('Material')
  })

  it('no inventa una traducción para claves rotas de datos', () => {
    expect(translateAttributeLabel('cristal')).toBe('Cristal')
  })
})

// ─── formatPrice ─────────────────────────────────────────────────────────────

const uyu: Partial<OrganizationSettings> = {
  locale: 'es-UY',
  currency: 'UYU',
  decimal_places: 0,
}

const usd: Partial<OrganizationSettings> = {
  locale: 'en-US',
  currency: 'USD',
  decimal_places: 2,
}

describe('formatPrice', () => {
  it('formatea precio en UYU sin decimales', () => {
    const result = formatPrice(1700, uyu as OrganizationSettings)
    expect(result).toContain('1')
    expect(result).toContain('700')
    // El símbolo puede variar por plataforma, lo importante es que incluye el número
  })

  it('formatea precio en USD con 2 decimales', () => {
    const result = formatPrice(42.5, usd as OrganizationSettings)
    expect(result).toContain('42')
    expect(result).toContain('50')
  })

  it('formatea 0 correctamente', () => {
    const result = formatPrice(0, uyu as OrganizationSettings)
    expect(result).toContain('0')
  })

  it('usa defaults (ARS) sin settings', () => {
    const result = formatPrice(1000)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('usa settings null como fallback a defaults', () => {
    const result = formatPrice(500, null)
    expect(typeof result).toBe('string')
  })
})

// ─── formatDateShort ──────────────────────────────────────────────────────────

describe('formatDateShort', () => {
  it('retorna guión para null', () => {
    expect(formatDateShort(null)).toBe('-')
  })

  it('retorna guión para undefined', () => {
    expect(formatDateShort(undefined)).toBe('-')
  })

  it('formatea una fecha válida como string ISO', () => {
    const result = formatDateShort('2025-03-25T00:00:00.000Z')
    expect(result).not.toBe('-')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formatea un objeto Date', () => {
    const result = formatDateShort(new Date('2025-01-15'))
    expect(result).not.toBe('-')
    expect(result).toContain('2025')
  })

  it('incluye el año en el resultado', () => {
    const result = formatDateShort('2024-06-01T00:00:00.000Z')
    expect(result).toContain('2024')
  })
})
