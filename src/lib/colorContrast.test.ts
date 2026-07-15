import { describe, it, expect } from 'vitest'
import { getReadableTextColor } from './colorContrast'

describe('getReadableTextColor', () => {
  it('retorna blanco para un fondo oscuro (navy de marca)', () => {
    expect(getReadableTextColor('#1c1d33')).toBe('#ffffff')
  })

  it('retorna tinta oscura para un rojo saturado de brillo medio (rojo de marca) — el canal rojo pesa poco en la luminancia WCAG', () => {
    expect(getReadableTextColor('#fd2525')).toBe('#111827')
  })

  it('retorna tinta oscura para un fondo pastel claro', () => {
    expect(getReadableTextColor('#fef3c7')).toBe('#111827')
  })

  it('retorna tinta oscura para blanco puro', () => {
    expect(getReadableTextColor('#ffffff')).toBe('#111827')
  })

  it('retorna blanco para negro puro', () => {
    expect(getReadableTextColor('#000000')).toBe('#ffffff')
  })

  it('retorna blanco por defecto cuando el color es null', () => {
    expect(getReadableTextColor(null)).toBe('#ffffff')
  })

  it('retorna blanco por defecto cuando el color es undefined', () => {
    expect(getReadableTextColor(undefined)).toBe('#ffffff')
  })

  it('retorna blanco por defecto para un string vacío', () => {
    expect(getReadableTextColor('')).toBe('#ffffff')
  })

  it('retorna blanco por defecto para un hex inválido (no 6 dígitos)', () => {
    expect(getReadableTextColor('#fff')).toBe('#ffffff')
  })

  it('retorna blanco por defecto para un valor que no es hex (ej. rgb())', () => {
    expect(getReadableTextColor('rgb(99, 102, 241)')).toBe('#ffffff')
  })

  it('acepta hex en mayúsculas', () => {
    expect(getReadableTextColor('#1C1D33')).toBe('#ffffff')
  })

  it('retorna blanco por defecto para hex con espacios alrededor (no se recorta)', () => {
    expect(getReadableTextColor(' #1c1d33 ')).toBe('#ffffff')
  })
})
