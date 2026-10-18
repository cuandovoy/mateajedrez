import { describe, expect, it } from 'vitest'
import { checkoutSchema, getDeliveryMethod } from './schemas'

const contact = {
  fullName: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '099 123 456',
}

const shipping = {
  ...contact,
  deliveryMethod: 'shipping' as const,
  address: 'Bulevar Artigas 1234',
  city: 'Montevideo',
  department: 'Montevideo' as const,
}

const pickup = { ...contact, deliveryMethod: 'pickup' as const }

function messages(result: ReturnType<typeof checkoutSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('checkoutSchema', () => {
  it('acepta un envío válido a un departamento distinto de Paysandú', () => {
    expect(checkoutSchema.safeParse(shipping).success).toBe(true)
  })

  it('acepta retiro en local solo con nombre, email y teléfono', () => {
    expect(checkoutSchema.safeParse(pickup).success).toBe(true)
  })

  it('acepta retiro en local con campos de dirección vacíos (el form los deja en blanco)', () => {
    const result = checkoutSchema.safeParse({ ...pickup, address: '', city: '', department: undefined })
    expect(result.success).toBe(true)
  })

  it('rechaza un deliveryMethod desconocido', () => {
    expect(checkoutSchema.safeParse({ ...shipping, deliveryMethod: 'drone' }).success).toBe(false)
  })

  it('rechaza cuando falta deliveryMethod', () => {
    const { deliveryMethod: _omit, ...rest } = shipping
    expect(checkoutSchema.safeParse(rest).success).toBe(false)
  })

  it('rechaza nombre vacío en ambos modos', () => {
    expect(checkoutSchema.safeParse({ ...shipping, fullName: '   ' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...pickup, fullName: '' }).success).toBe(false)
  })

  it('rechaza email inválido en ambos modos', () => {
    expect(checkoutSchema.safeParse({ ...shipping, email: 'no-es-email' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...pickup, email: '' }).success).toBe(false)
  })

  it('rechaza teléfono inválido en ambos modos', () => {
    expect(checkoutSchema.safeParse({ ...shipping, phone: '123' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...pickup, phone: '' }).success).toBe(false)
  })

  it('rechaza envío sin dirección', () => {
    expect(checkoutSchema.safeParse({ ...shipping, address: '' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...shipping, address: undefined }).success).toBe(false)
  })

  it('rechaza envío sin ciudad', () => {
    expect(checkoutSchema.safeParse({ ...shipping, city: ' ' }).success).toBe(false)
  })

  it('rechaza envío sin departamento', () => {
    const result = checkoutSchema.safeParse({ ...shipping, department: undefined })
    expect(result.success).toBe(false)
    expect(messages(result)).toContain('Seleccioná un departamento')
  })

  it('rechaza envío con departamento fuera de la lista', () => {
    expect(checkoutSchema.safeParse({ ...shipping, department: 'Atlantis' }).success).toBe(false)
  })

  it('rechaza envío a Paysandú y sugiere Retiro en local', () => {
    const result = checkoutSchema.safeParse({ ...shipping, department: 'Paysandú' })
    expect(result.success).toBe(false)
    expect(messages(result)).toContain('Los envíos no incluyen Paysandú. Elegí Retiro en local.')
  })

  it('reporta el error de Paysandú sobre el campo department', () => {
    const result = checkoutSchema.safeParse({ ...shipping, department: 'Paysandú' })
    expect(!result.success && result.error.issues[0].path).toEqual(['department'])
  })
})

describe('getDeliveryMethod', () => {
  it('retorna pickup cuando delivery_method es pickup', () => {
    expect(getDeliveryMethod({ delivery_method: 'pickup' })).toBe('pickup')
  })

  it('retorna shipping cuando delivery_method es shipping', () => {
    expect(getDeliveryMethod({ delivery_method: 'shipping' })).toBe('shipping')
  })

  it('retorna shipping para órdenes legacy sin la clave', () => {
    expect(getDeliveryMethod({ address: 'Calle 1' })).toBe('shipping')
  })

  it('retorna shipping para null y undefined', () => {
    expect(getDeliveryMethod(null)).toBe('shipping')
    expect(getDeliveryMethod(undefined)).toBe('shipping')
  })

  it('retorna shipping para valores desconocidos o de tipo incorrecto', () => {
    expect(getDeliveryMethod({ delivery_method: 'drone' })).toBe('shipping')
    expect(getDeliveryMethod({ delivery_method: 42 })).toBe('shipping')
    expect(getDeliveryMethod('pickup')).toBe('shipping')
  })
})
