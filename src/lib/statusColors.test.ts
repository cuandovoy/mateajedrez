import { describe, it, expect } from 'vitest'
import {
  getOrderStatusColor,
  getTransferStatusColor,
  getStockLevelColor,
  getStockLevelFromFlags,
  getStockLevelFromDays,
} from './statusColors'

describe('getOrderStatusColor', () => {
  it('retorna amarillo para pending', () => {
    expect(getOrderStatusColor('pending')).toBe('bg-yellow-100 text-yellow-800')
  })

  it('retorna naranja para pending_allocation', () => {
    expect(getOrderStatusColor('pending_allocation')).toBe('bg-orange-100 text-orange-800')
  })

  it('retorna azul para processing', () => {
    expect(getOrderStatusColor('processing')).toBe('bg-blue-100 text-blue-800')
  })

  it('retorna violeta para shipped', () => {
    expect(getOrderStatusColor('shipped')).toBe('bg-purple-100 text-purple-800')
  })

  it('retorna verde para delivered', () => {
    expect(getOrderStatusColor('delivered')).toBe('bg-green-100 text-green-800')
  })

  it('retorna rojo para cancelled', () => {
    expect(getOrderStatusColor('cancelled')).toBe('bg-red-100 text-red-800')
  })

  it('retorna gris neutro para null', () => {
    expect(getOrderStatusColor(null)).toBe('bg-gray-100 text-gray-800')
  })

  it('retorna gris neutro para undefined', () => {
    expect(getOrderStatusColor(undefined)).toBe('bg-gray-100 text-gray-800')
  })

  it('retorna gris neutro para un estado desconocido', () => {
    expect(getOrderStatusColor('estado_inexistente')).toBe('bg-gray-100 text-gray-800')
  })
})

describe('getTransferStatusColor', () => {
  it('retorna verde para completed', () => {
    expect(getTransferStatusColor('completed')).toBe('bg-green-100 text-green-800')
  })

  it('retorna rojo para cancelled', () => {
    expect(getTransferStatusColor('cancelled')).toBe('bg-red-100 text-red-800')
  })

  it('retorna amarillo para in_transit', () => {
    expect(getTransferStatusColor('in_transit')).toBe('bg-yellow-100 text-yellow-800')
  })

  it('retorna azul para pending (sin entrada propia, comportamiento histórico)', () => {
    expect(getTransferStatusColor('pending')).toBe('bg-blue-100 text-blue-800')
  })

  it('retorna azul para null', () => {
    expect(getTransferStatusColor(null)).toBe('bg-blue-100 text-blue-800')
  })

  it('retorna azul para un estado desconocido', () => {
    expect(getTransferStatusColor('estado_inexistente')).toBe('bg-blue-100 text-blue-800')
  })
})

describe('getStockLevelColor', () => {
  it('retorna set verde para ok', () => {
    expect(getStockLevelColor('ok')).toEqual({
      text: 'text-green-600',
      bg: 'bg-green-50',
      badge: 'bg-green-100 text-green-700',
    })
  })

  it('retorna set amarillo para low', () => {
    expect(getStockLevelColor('low')).toEqual({
      text: 'text-yellow-600',
      bg: 'bg-yellow-50',
      badge: 'bg-yellow-100 text-yellow-700',
    })
  })

  it('retorna set rojo para critical', () => {
    expect(getStockLevelColor('critical')).toEqual({
      text: 'text-red-600',
      bg: 'bg-red-50',
      badge: 'bg-red-100 text-red-700',
    })
  })
})

describe('getStockLevelFromFlags', () => {
  it('retorna critical cuando el stock es 0', () => {
    expect(getStockLevelFromFlags({ stock: 0, isLowStock: false })).toBe('critical')
  })

  it('retorna critical cuando el stock es negativo', () => {
    expect(getStockLevelFromFlags({ stock: -1, isLowStock: false })).toBe('critical')
  })

  it('prioriza critical sobre low cuando ambas condiciones aplican', () => {
    expect(getStockLevelFromFlags({ stock: 0, isLowStock: true })).toBe('critical')
  })

  it('retorna low cuando is_low_stock es true y hay stock', () => {
    expect(getStockLevelFromFlags({ stock: 3, isLowStock: true })).toBe('low')
  })

  it('retorna ok cuando hay stock suficiente', () => {
    expect(getStockLevelFromFlags({ stock: 50, isLowStock: false })).toBe('ok')
  })
})

describe('getStockLevelFromDays', () => {
  it('retorna ok cuando dias_stock es null (sin datos suficientes)', () => {
    expect(getStockLevelFromDays(null)).toBe('ok')
  })

  it('retorna ok cuando dias_stock es undefined', () => {
    expect(getStockLevelFromDays(undefined)).toBe('ok')
  })

  it('retorna critical en el límite inferior del rango crítico (6 días)', () => {
    expect(getStockLevelFromDays(6)).toBe('critical')
  })

  it('retorna low en el límite exacto de 7 días (ya no es crítico)', () => {
    expect(getStockLevelFromDays(7)).toBe('low')
  })

  it('retorna low en el límite superior del rango bajo (13 días)', () => {
    expect(getStockLevelFromDays(13)).toBe('low')
  })

  it('retorna ok en el límite exacto de 14 días (ya no es bajo)', () => {
    expect(getStockLevelFromDays(14)).toBe('ok')
  })

  it('retorna ok para valores altos de dias_stock', () => {
    expect(getStockLevelFromDays(30)).toBe('ok')
  })

  it('retorna critical para 0 días de stock', () => {
    expect(getStockLevelFromDays(0)).toBe('critical')
  })
})
