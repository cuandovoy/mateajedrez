import { describe, it, expect, vi, afterEach } from 'vitest'
import { toOrgDateKey, orgTzOffset, buildDateRange } from './dateUtils'

// ─── toOrgDateKey ─────────────────────────────────────────────────────────────

describe('toOrgDateKey', () => {
  it('retorna la fecha en UTC para timezone UTC', () => {
    expect(toOrgDateKey(new Date('2025-05-13T12:00:00Z'), 'UTC')).toBe('2025-05-13')
  })

  it('retorna la fecha local en America/Montevideo cuando la hora UTC cruza medianoche', () => {
    // 02:00 UTC = 23:00 del día anterior en Montevideo (UTC-3)
    expect(toOrgDateKey(new Date('2025-05-13T02:00:00Z'), 'America/Montevideo')).toBe('2025-05-12')
  })

  it('retorna el mismo día cuando la hora UTC no cruza medianoche en Montevideo', () => {
    // 15:00 UTC = 12:00 en Montevideo — mismo día
    expect(toOrgDateKey(new Date('2025-05-13T15:00:00Z'), 'America/Montevideo')).toBe('2025-05-13')
  })

  it('maneja el último día del año correctamente', () => {
    expect(toOrgDateKey(new Date('2025-12-31T12:00:00Z'), 'UTC')).toBe('2025-12-31')
  })

  it('maneja el cambio de año', () => {
    expect(toOrgDateKey(new Date('2026-01-01T00:00:00Z'), 'UTC')).toBe('2026-01-01')
  })

  it('retorna formato YYYY-MM-DD estricto', () => {
    expect(toOrgDateKey(new Date('2025-01-05T12:00:00Z'), 'UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('padding de mes y día con cero', () => {
    expect(toOrgDateKey(new Date('2025-01-05T12:00:00Z'), 'UTC')).toBe('2025-01-05')
  })
})

// ─── orgTzOffset ──────────────────────────────────────────────────────────────

describe('orgTzOffset', () => {
  it('retorna formato ±HH:MM para UTC', () => {
    expect(orgTzOffset(new Date('2025-05-13T12:00:00Z'), 'UTC')).toMatch(/^[+-]\d{2}:\d{2}$/)
  })

  it('retorna formato ±HH:MM para timezone con offset negativo', () => {
    expect(orgTzOffset(new Date('2025-05-13T12:00:00Z'), 'America/Montevideo')).toMatch(
      /^[+-]\d{2}:\d{2}$/
    )
  })

  it('retorna formato ±HH:MM para timezone con offset positivo', () => {
    expect(orgTzOffset(new Date('2025-05-13T12:00:00Z'), 'Asia/Tokyo')).toMatch(
      /^[+-]\d{2}:\d{2}$/
    )
  })

  it('siempre retorna exactamente 6 caracteres (±HH:MM)', () => {
    const result = orgTzOffset(new Date('2025-05-13T12:00:00Z'), 'America/Montevideo')
    expect(result).toHaveLength(6)
  })
})

// ─── buildDateRange ───────────────────────────────────────────────────────────

describe('buildDateRange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna las tres claves esperadas', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-05-13T12:00:00Z'))
    const range = buildDateRange('UTC')
    expect(range).toHaveProperty('monthStart')
    expect(range).toHaveProperty('prevMonthStart')
    expect(range).toHaveProperty('prevMonthEnd')
  })

  it('monthStart apunta al día 1 del mes actual', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-05-13T12:00:00Z'))
    expect(buildDateRange('UTC').monthStart).toMatch(/^2025-05-01T/)
  })

  it('prevMonthStart apunta al día 1 del mes anterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-05-13T12:00:00Z'))
    expect(buildDateRange('UTC').prevMonthStart).toMatch(/^2025-04-01T/)
  })

  it('prevMonthEnd apunta al mismo día del mes anterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-05-13T12:00:00Z'))
    expect(buildDateRange('UTC').prevMonthEnd).toMatch(/^2025-04-13T/)
  })

  it('cruza correctamente el límite de año en enero', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
    const range = buildDateRange('UTC')
    expect(range.monthStart).toMatch(/^2025-01-01T/)
    expect(range.prevMonthStart).toMatch(/^2024-12-01T/)
    expect(range.prevMonthEnd).toMatch(/^2024-12-15T/)
  })

  it('ajusta prevMonthEnd al último día cuando el mes anterior es más corto', () => {
    // Marzo 31 → febrero 2025 tiene 28 días
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-03-31T12:00:00Z'))
    expect(buildDateRange('UTC').prevMonthEnd).toMatch(/^2025-02-28T/)
  })

  it('monthStart y prevMonthStart empiezan a las 00:00:00', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-05-13T12:00:00Z'))
    const range = buildDateRange('UTC')
    expect(range.monthStart).toMatch(/T00:00:00/)
    expect(range.prevMonthStart).toMatch(/T00:00:00/)
  })

  it('prevMonthEnd termina a las 23:59:59', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-05-13T12:00:00Z'))
    expect(buildDateRange('UTC').prevMonthEnd).toMatch(/T23:59:59/)
  })
})
