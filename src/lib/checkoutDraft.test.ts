import { describe, expect, it } from 'vitest'
import {
  checkoutDraftKey,
  clearCheckoutDraft,
  isCheckoutFormPristine,
  loadCheckoutDraft,
  parseCheckoutDraft,
  saveCheckoutDraft,
  serializeCheckoutDraft,
} from './checkoutDraft'

function createStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v },
    removeItem: (k: string) => { delete data[k] },
  }
}

const fullDraft = {
  deliveryMethod: 'shipping' as const,
  fullName: 'Ana Pérez',
  email: 'ana@mail.com',
  phone: '099 123 456',
  address: 'Calle 1 234',
  city: 'Salto',
  department: 'Salto',
  paymentMethod: 'transfer',
}

describe('checkoutDraftKey', () => {
  it('namespacea la clave por organización', () => {
    expect(checkoutDraftKey('org-1')).not.toBe(checkoutDraftKey('org-2'))
    expect(checkoutDraftKey('org-1')).toContain('org-1')
  })
})

describe('serializeCheckoutDraft', () => {
  it('serializa solo los campos permitidos', () => {
    const raw = serializeCheckoutDraft({ ...fullDraft, couponCode: 'SECRET', recaptchaToken: 'x' } as never)
    const parsed = JSON.parse(raw)
    expect(Object.keys(parsed).sort()).toEqual(
      ['address', 'city', 'deliveryMethod', 'department', 'email', 'fullName', 'paymentMethod', 'phone'],
    )
    expect(raw).not.toContain('SECRET')
  })
})

describe('parseCheckoutDraft', () => {
  it('recupera un borrador válido (ida y vuelta)', () => {
    expect(parseCheckoutDraft(serializeCheckoutDraft(fullDraft))).toEqual(fullDraft)
  })

  it('retorna null para null, vacío o JSON inválido', () => {
    expect(parseCheckoutDraft(null)).toBeNull()
    expect(parseCheckoutDraft('')).toBeNull()
    expect(parseCheckoutDraft('{no es json')).toBeNull()
  })

  it('retorna null si el JSON no es un objeto', () => {
    expect(parseCheckoutDraft('[]')).toBeNull()
    expect(parseCheckoutDraft('"texto"')).toBeNull()
    expect(parseCheckoutDraft('42')).toBeNull()
    expect(parseCheckoutDraft('null')).toBeNull()
  })

  it('descarta campos con tipo incorrecto (null no es string)', () => {
    const draft = parseCheckoutDraft(JSON.stringify({ fullName: null, phone: 5, city: 'Salto' }))
    expect(draft).toEqual({ city: 'Salto' })
  })

  it('descarta un deliveryMethod desconocido', () => {
    const draft = parseCheckoutDraft(JSON.stringify({ deliveryMethod: 'drone', city: 'Salto' }))
    expect(draft).toEqual({ city: 'Salto' })
  })

  it('ignora campos extra como cupón o recaptcha', () => {
    const draft = parseCheckoutDraft(JSON.stringify({ city: 'Salto', couponCode: 'X', recaptchaToken: 'y' }))
    expect(draft).toEqual({ city: 'Salto' })
  })

  it('retorna null si no queda ningún campo válido', () => {
    expect(parseCheckoutDraft(JSON.stringify({ couponCode: 'X' }))).toBeNull()
    expect(parseCheckoutDraft('{}')).toBeNull()
  })

  it('recorta valores absurdamente largos', () => {
    const draft = parseCheckoutDraft(JSON.stringify({ address: 'a'.repeat(5000) }))
    expect(draft?.address?.length).toBeLessThanOrEqual(500)
  })
})

describe('isCheckoutFormPristine', () => {
  it('es true con el formulario vacío aunque el email esté precargado por la sesión', () => {
    expect(isCheckoutFormPristine({ fullName: '', phone: '', address: '', city: '', department: '', email: 'u@mail.com' })).toBe(true)
  })

  it('es true con campos undefined o solo espacios', () => {
    expect(isCheckoutFormPristine({ fullName: '  ', phone: undefined })).toBe(true)
  })

  it('es false si el usuario ya escribió el nombre', () => {
    expect(isCheckoutFormPristine({ fullName: 'Ana' })).toBe(false)
  })

  it('es false si hay dirección cargada', () => {
    expect(isCheckoutFormPristine({ address: 'Calle 1' })).toBe(false)
  })
})

describe('persistencia en storage', () => {
  it('guarda y carga el borrador bajo la clave de la organización', () => {
    const storage = createStorage()
    saveCheckoutDraft('org-1', fullDraft, storage)
    expect(storage.data[checkoutDraftKey('org-1')]).toBeDefined()
    expect(loadCheckoutDraft('org-1', storage)).toEqual(fullDraft)
    expect(loadCheckoutDraft('org-2', storage)).toBeNull()
  })

  it('clearCheckoutDraft elimina el borrador', () => {
    const storage = createStorage()
    saveCheckoutDraft('org-1', fullDraft, storage)
    clearCheckoutDraft('org-1', storage)
    expect(loadCheckoutDraft('org-1', storage)).toBeNull()
  })

  it('no explota si el storage lanza (modo privado / bloqueado)', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(() => saveCheckoutDraft('org-1', fullDraft, broken)).not.toThrow()
    expect(loadCheckoutDraft('org-1', broken)).toBeNull()
    expect(() => clearCheckoutDraft('org-1', broken)).not.toThrow()
  })

  it('retorna null si no hay storage disponible', () => {
    expect(loadCheckoutDraft('org-1', null)).toBeNull()
    expect(() => saveCheckoutDraft('org-1', fullDraft, null)).not.toThrow()
  })

  it('descarta un valor corrupto guardado en storage', () => {
    const storage = createStorage({ [checkoutDraftKey('org-1')]: '{corrupto' })
    expect(loadCheckoutDraft('org-1', storage)).toBeNull()
  })
})
