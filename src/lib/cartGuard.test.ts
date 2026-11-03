import { describe, it, expect } from 'vitest'
import {
  isProductPurchasableInStore,
  findBlockedCartItems,
  blockedReasonMessage,
  mapOrderItemsInsertError,
} from './cartGuard'

const ok = { id: 'p1', is_active: true, visible_in_store: true, requires_availability_check: false }

describe('isProductPurchasableInStore', () => {
  it('retorna true para producto activo, visible y sin consulta de disponibilidad', () => {
    expect(isProductPurchasableInStore(ok)).toBe(true)
  })
  it('retorna false para null/undefined', () => {
    expect(isProductPurchasableInStore(null)).toBe(false)
    expect(isProductPurchasableInStore(undefined)).toBe(false)
  })
  it('retorna false si el producto está inactivo', () => {
    expect(isProductPurchasableInStore({ ...ok, is_active: false })).toBe(false)
  })
  it('retorna false si is_active es null (falla cerrado)', () => {
    expect(isProductPurchasableInStore({ ...ok, is_active: null })).toBe(false)
  })
  it('retorna false si visible_in_store es false', () => {
    expect(isProductPurchasableInStore({ ...ok, visible_in_store: false })).toBe(false)
  })
  it('retorna false si visible_in_store es null (falla cerrado)', () => {
    expect(isProductPurchasableInStore({ ...ok, visible_in_store: null })).toBe(false)
  })
  it('trata visible_in_store undefined como visible (select legacy sin la columna)', () => {
    expect(isProductPurchasableInStore({ id: 'p1', is_active: true })).toBe(true)
  })
  it('retorna false si requiere consulta de disponibilidad', () => {
    expect(isProductPurchasableInStore({ ...ok, requires_availability_check: true })).toBe(false)
  })
})

describe('findBlockedCartItems', () => {
  const item = (id: string, product_id: string, name = 'Mate') => ({ id, product_id, name })

  it('retorna [] para carrito vacío', () => {
    expect(findBlockedCartItems([], [])).toEqual([])
  })
  it('retorna [] cuando todos los productos son comprables', () => {
    expect(findBlockedCartItems([item('i1', 'p1')], [ok])).toEqual([])
  })
  it('bloquea con motivo inquiry los productos que requieren consulta', () => {
    const r = findBlockedCartItems([item('i1', 'p1')], [{ ...ok, requires_availability_check: true }])
    expect(r).toEqual([{ itemId: 'i1', productId: 'p1', name: 'Mate', reason: 'inquiry' }])
  })
  it('bloquea con motivo hidden los productos no visibles en tienda', () => {
    const r = findBlockedCartItems([item('i1', 'p1')], [{ ...ok, visible_in_store: false }])
    expect(r[0].reason).toBe('hidden')
  })
  it('bloquea con motivo inactive los productos inactivos', () => {
    const r = findBlockedCartItems([item('i1', 'p1')], [{ ...ok, is_active: false }])
    expect(r[0].reason).toBe('inactive')
  })
  it('bloquea con motivo missing si el producto no vino en la consulta (RLS o borrado)', () => {
    const r = findBlockedCartItems([item('i1', 'p-gone')], [ok])
    expect(r[0].reason).toBe('missing')
  })
  it('prioriza inactive sobre hidden e inquiry', () => {
    const r = findBlockedCartItems(
      [item('i1', 'p1')],
      [{ ...ok, is_active: false, visible_in_store: false, requires_availability_check: true }]
    )
    expect(r[0].reason).toBe('inactive')
  })
  it('solo devuelve los items bloqueados cuando el carrito es mixto', () => {
    const r = findBlockedCartItems(
      [item('i1', 'p1'), item('i2', 'p2', 'Bombilla')],
      [ok, { ...ok, id: 'p2', requires_availability_check: true }]
    )
    expect(r.map((b) => b.itemId)).toEqual(['i2'])
  })
  it('bloquea dos items de variantes distintas del mismo producto bloqueado', () => {
    const r = findBlockedCartItems(
      [item('i1', 'p1'), item('i2', 'p1')],
      [{ ...ok, visible_in_store: false }]
    )
    expect(r).toHaveLength(2)
  })
})

describe('blockedReasonMessage', () => {
  it('devuelve un mensaje en español para cada motivo', () => {
    expect(blockedReasonMessage('inquiry')).toMatch(/consult/i)
    expect(blockedReasonMessage('hidden')).toMatch(/no está disponible/i)
    expect(blockedReasonMessage('inactive')).toMatch(/no está disponible/i)
    expect(blockedReasonMessage('missing')).toMatch(/no está disponible/i)
  })
})

describe('mapOrderItemsInsertError', () => {
  it('retorna null si no hay error', () => {
    expect(mapOrderItemsInsertError(null)).toBeNull()
  })
  it('mapea 23514 de disponibilidad a mensaje de consulta', () => {
    const msg = mapOrderItemsInsertError({
      code: '23514',
      message: 'Consultá la disponibilidad de este producto con la tienda antes de comprar.',
    })
    expect(msg).toMatch(/consult/i)
  })
  it('mapea 23514 de producto oculto a mensaje de no disponible', () => {
    const msg = mapOrderItemsInsertError({ code: '23514', message: 'Producto no disponible en la tienda' })
    expect(msg).toMatch(/no está disponible/i)
  })
  it('mapea cualquier otro 23514 a un mensaje genérico amigable', () => {
    const msg = mapOrderItemsInsertError({ code: '23514', message: 'algo raro' })
    expect(msg).toMatch(/no se pudo/i)
  })
  it('retorna null para otros códigos (no es un error conocido)', () => {
    expect(mapOrderItemsInsertError({ code: '42501', message: 'rls' })).toBeNull()
  })
  it('retorna null si el error no tiene code', () => {
    expect(mapOrderItemsInsertError({ message: 'boom' })).toBeNull()
  })
})
