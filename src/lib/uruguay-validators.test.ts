import { describe, it, expect } from 'vitest'
import {
  validateUruguayanRUT,
  formatUruguayanRUT,
  validateUruguayanPhone,
  formatUruguayanPhone,
  normalizeUruguayanPhone,
} from './uruguay-validators'

// ─── RUT ────────────────────────────────────────────────────────────────────

describe('validateUruguayanRUT', () => {
  it('acepta RUT con 12 dígitos sin formato', () => {
    expect(validateUruguayanRUT('219999990018')).toBe(true)
  })

  it('acepta RUT con formato XX.XXXXXX.001-X', () => {
    expect(validateUruguayanRUT('21.999999.001-8')).toBe(true)
  })

  it('acepta RUT con espacios', () => {
    expect(validateUruguayanRUT('21 999999 001 8')).toBe(true)
  })

  it('rechaza RUT con menos de 12 dígitos', () => {
    expect(validateUruguayanRUT('2199999')).toBe(false)
  })

  it('rechaza RUT con más de 12 dígitos', () => {
    expect(validateUruguayanRUT('2199999900181234')).toBe(false)
  })

  it('rechaza RUT con letras', () => {
    expect(validateUruguayanRUT('21999999001X')).toBe(false)
  })

  it('rechaza string vacío', () => {
    expect(validateUruguayanRUT('')).toBe(false)
  })

  it('rechaza null/undefined', () => {
    expect(validateUruguayanRUT(null as unknown as string)).toBe(false)
    expect(validateUruguayanRUT(undefined as unknown as string)).toBe(false)
  })
})

describe('formatUruguayanRUT', () => {
  it('formatea 12 dígitos a XX.XXXXXX.XXX-X', () => {
    expect(formatUruguayanRUT('219999990018')).toBe('21.999999.001-8')
  })

  it('retorna el valor original si no tiene 12 dígitos', () => {
    expect(formatUruguayanRUT('123')).toBe('123')
  })

  it('retorna string vacío para input vacío', () => {
    expect(formatUruguayanRUT('')).toBe('')
  })
})

// ─── TELÉFONO ────────────────────────────────────────────────────────────────

describe('validateUruguayanPhone', () => {
  it('acepta móvil con prefijo +598', () => {
    expect(validateUruguayanPhone('+598 9 123 4567')).toBe(true)
  })

  it('acepta móvil solo 8 dígitos', () => {
    expect(validateUruguayanPhone('91234567')).toBe(true)
  })

  it('acepta teléfono fijo Montevideo (empieza con 2)', () => {
    expect(validateUruguayanPhone('21234567')).toBe(true)
  })

  it('acepta teléfono interior (empieza con 4)', () => {
    expect(validateUruguayanPhone('41234567')).toBe(true)
  })

  it('acepta con prefijo 00598', () => {
    expect(validateUruguayanPhone('0059891234567')).toBe(true)
  })

  it('acepta con prefijo 598 sin +', () => {
    expect(validateUruguayanPhone('59891234567')).toBe(true)
  })

  it('rechaza número con 7 dígitos (muy corto)', () => {
    expect(validateUruguayanPhone('9123456')).toBe(false)
  })

  it('rechaza número con 9 dígitos (muy largo)', () => {
    expect(validateUruguayanPhone('912345678')).toBe(false)
  })

  it('rechaza número que empieza con 1', () => {
    expect(validateUruguayanPhone('11234567')).toBe(false)
  })

  it('rechaza número que empieza con 3', () => {
    expect(validateUruguayanPhone('31234567')).toBe(false)
  })

  it('rechaza string vacío', () => {
    expect(validateUruguayanPhone('')).toBe(false)
  })

  it('rechaza null/undefined', () => {
    expect(validateUruguayanPhone(null as unknown as string)).toBe(false)
  })
})

describe('formatUruguayanPhone', () => {
  it('formatea 8 dígitos a +598 X XXX XXXX', () => {
    expect(formatUruguayanPhone('91234567')).toBe('+598 9 123 4567')
  })

  it('formatea número con +598 prefix', () => {
    expect(formatUruguayanPhone('+59891234567')).toBe('+598 9 123 4567')
  })

  it('retorna el original si no tiene 8 dígitos', () => {
    expect(formatUruguayanPhone('123')).toBe('123')
  })
})

describe('normalizeUruguayanPhone', () => {
  it('normaliza 8 dígitos agregando +598', () => {
    expect(normalizeUruguayanPhone('91234567')).toBe('+59891234567')
  })

  it('mantiene +598 si ya lo tiene', () => {
    expect(normalizeUruguayanPhone('+59891234567')).toBe('+59891234567')
  })

  it('convierte 00598 a +598', () => {
    expect(normalizeUruguayanPhone('0059891234567')).toBe('+59891234567')
  })

  it('convierte 598 sin + a +598', () => {
    expect(normalizeUruguayanPhone('59891234567')).toBe('+59891234567')
  })

  it('retorna string vacío para input vacío', () => {
    expect(normalizeUruguayanPhone('')).toBe('')
  })
})
