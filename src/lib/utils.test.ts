import { describe, it, expect } from 'vitest'
import { capitalizeFirst, formatPrice, formatDateShort } from './utils'
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
