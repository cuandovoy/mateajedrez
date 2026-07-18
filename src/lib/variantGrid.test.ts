import { describe, expect, it } from 'vitest'
import {
  buildVariantBatch,
  formatAttributesValue,
  normalizeOptionalText,
  parseAttributesInput,
  parseNonNegativeNumber,
  parseOptionalNumber,
  parseOptionalPrice,
  validateVariantSkus,
  type VariantRowInput,
} from './variantGrid'

function makeRow(overrides: Partial<VariantRowInput> = {}): VariantRowInput {
  return {
    id: null,
    product_id: 'product-1',
    sku: 'SKU-1',
    name: null,
    attributes: null,
    price: null,
    stock: 0,
    unit: null,
    min_stock: 0,
    low_stock_threshold: 10,
    is_active: true,
    image_url: null,
    ...overrides,
  }
}

describe('normalizeOptionalText', () => {
  it('recorta espacios en un texto válido', () => {
    expect(normalizeOptionalText('  Rojo  ')).toBe('Rojo')
  })
  it('retorna null para string vacío', () => {
    expect(normalizeOptionalText('')).toBeNull()
  })
  it('retorna null para string de solo espacios', () => {
    expect(normalizeOptionalText('   ')).toBeNull()
  })
  it('retorna null para undefined', () => {
    expect(normalizeOptionalText(undefined)).toBeNull()
  })
  it('retorna null para null', () => {
    expect(normalizeOptionalText(null)).toBeNull()
  })
})

describe('parseOptionalNumber', () => {
  it('parsea un número válido', () => {
    expect(parseOptionalNumber('10.5')).toBe(10.5)
  })
  it('retorna null para string vacío', () => {
    expect(parseOptionalNumber('')).toBeNull()
  })
  it('retorna null para string no numérico', () => {
    expect(parseOptionalNumber('abc')).toBeNull()
  })
  it('acepta números negativos (la validación de negativos es de cada caller)', () => {
    expect(parseOptionalNumber('-5')).toBe(-5)
  })
})

describe('parseOptionalPrice', () => {
  it('acepta precio en límite inferior (0)', () => {
    expect(parseOptionalPrice('0')).toBe(0)
  })
  it('acepta un precio positivo', () => {
    expect(parseOptionalPrice('199.99')).toBe(199.99)
  })
  it('retorna null para string vacío (hereda el precio del producto)', () => {
    expect(parseOptionalPrice('')).toBeNull()
  })
  it('retorna null para precio negativo (se trata como "sin override")', () => {
    expect(parseOptionalPrice('-1')).toBeNull()
  })
  it('retorna null para texto no numérico', () => {
    expect(parseOptionalPrice('abc')).toBeNull()
  })
})

describe('parseNonNegativeNumber', () => {
  it('acepta el valor mínimo (0)', () => {
    expect(parseNonNegativeNumber('0', 10)).toBe(0)
  })
  it('acepta un valor positivo', () => {
    expect(parseNonNegativeNumber('25')).toBe(25)
  })
  it('cae al fallback con un valor negativo', () => {
    expect(parseNonNegativeNumber('-1', 10)).toBe(10)
  })
  it('cae al fallback con string vacío', () => {
    expect(parseNonNegativeNumber('', 5)).toBe(5)
  })
  it('cae al fallback (0 por defecto) con texto no numérico', () => {
    expect(parseNonNegativeNumber('abc')).toBe(0)
  })
})

describe('parseAttributesInput', () => {
  it('parsea un par color/talle', () => {
    expect(parseAttributesInput('color: Rojo, talle: M')).toEqual({ color: 'Rojo', talle: 'M' })
  })
  it('parsea sin espacios luego de los separadores', () => {
    expect(parseAttributesInput('color:Rojo,talle:M')).toEqual({ color: 'Rojo', talle: 'M' })
  })
  it('retorna null para string vacío', () => {
    expect(parseAttributesInput('')).toBeNull()
  })
  it('retorna null para texto sin ":"', () => {
    expect(parseAttributesInput('color Rojo')).toBeNull()
  })
  it('ignora un par con clave vacía', () => {
    expect(parseAttributesInput(': Rojo')).toBeNull()
  })
  it('ignora un par con valor vacío', () => {
    expect(parseAttributesInput('color:')).toBeNull()
  })
  it('ignora pares inválidos pero conserva los válidos', () => {
    expect(parseAttributesInput('color: Rojo, sinvalor:')).toEqual({ color: 'Rojo' })
  })
})

describe('formatAttributesValue', () => {
  it('formatea un objeto de atributos', () => {
    expect(formatAttributesValue({ color: 'Rojo', talle: 'M' })).toBe('color: Rojo, talle: M')
  })
  it('retorna string vacío para null', () => {
    expect(formatAttributesValue(null)).toBe('')
  })
  it('retorna string vacío para undefined', () => {
    expect(formatAttributesValue(undefined)).toBe('')
  })
  it('retorna string vacío para un objeto vacío', () => {
    expect(formatAttributesValue({})).toBe('')
  })
  it('retorna string vacío para un array (no es el shape esperado)', () => {
    expect(formatAttributesValue(['color'])).toBe('')
  })
})

describe('validateVariantSkus', () => {
  it('no reporta errores cuando todos los SKU son válidos y únicos', () => {
    const rows = [{ key: 'a', sku: 'SKU-1' }, { key: 'b', sku: 'SKU-2' }]
    expect(validateVariantSkus(rows)).toEqual([])
  })
  it('reporta un SKU vacío con el número de fila', () => {
    const rows = [{ key: 'a', sku: '' }]
    const errors = validateVariantSkus(rows)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('Fila 1')
  })
  it('reporta un SKU de solo espacios como vacío', () => {
    const rows = [{ key: 'a', sku: '   ' }]
    expect(validateVariantSkus(rows)[0].message).toContain('vacío')
  })
  it('reporta ambas filas cuando dos SKU son iguales', () => {
    const rows = [{ key: 'a', sku: 'SKU-1' }, { key: 'b', sku: 'SKU-1' }]
    const errors = validateVariantSkus(rows)
    expect(errors).toHaveLength(2)
    expect(errors.map((e) => e.key).sort()).toEqual(['a', 'b'])
  })
  it('detecta duplicados sin distinguir mayúsculas/minúsculas', () => {
    const rows = [{ key: 'a', sku: 'sku-1' }, { key: 'b', sku: 'SKU-1' }]
    expect(validateVariantSkus(rows)).toHaveLength(2)
  })
  it('detecta duplicados ignorando espacios al inicio/final', () => {
    const rows = [{ key: 'a', sku: ' SKU-1' }, { key: 'b', sku: 'SKU-1 ' }]
    expect(validateVariantSkus(rows)).toHaveLength(2)
  })
  it('no confunde dos grupos de duplicados distintos', () => {
    const rows = [
      { key: 'a', sku: 'X' },
      { key: 'b', sku: 'X' },
      { key: 'c', sku: 'Y' },
      { key: 'd', sku: 'Y' },
    ]
    const errors = validateVariantSkus(rows)
    expect(errors).toHaveLength(4)
  })
  it('retorna [] para una grilla vacía', () => {
    expect(validateVariantSkus([])).toEqual([])
  })
})

describe('buildVariantBatch', () => {
  it('manda una fila sin id al batch de inserts', () => {
    const row = makeRow({ sku: 'NEW-1' })
    const { inserts, updates } = buildVariantBatch([row], new Map())
    const { id: _unused, ...expected } = row
    expect(inserts).toEqual([expected])
    expect(updates).toEqual([])
    expect(_unused).toBeNull()
  })

  it('no genera update si la fila no cambió respecto del original', () => {
    const original = makeRow({ id: 'v1', sku: 'SKU-1', stock: 5 })
    const row = { ...original }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([])
  })

  it('genera update solo con los campos que cambiaron', () => {
    const original = makeRow({ id: 'v1', sku: 'SKU-1', stock: 5, price: null })
    const row = { ...original, stock: 8 }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([{ id: 'v1', changes: { stock: 8 } }])
  })

  it('detecta cambio de precio de null a un número', () => {
    const original = makeRow({ id: 'v1', price: null })
    const row = { ...original, price: 100 }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([{ id: 'v1', changes: { price: 100 } }])
  })

  it('detecta cambio de is_active (boolean)', () => {
    const original = makeRow({ id: 'v1', is_active: true })
    const row = { ...original, is_active: false }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([{ id: 'v1', changes: { is_active: false } }])
  })

  it('detecta cambios en attributes aunque el orden de claves difiera', () => {
    const original = makeRow({ id: 'v1', attributes: { color: 'Rojo', talle: 'M' } })
    const row = { ...original, attributes: { talle: 'M', color: 'Rojo' } }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([])
  })

  it('detecta cambios en attributes cuando un valor difiere', () => {
    const original = makeRow({ id: 'v1', attributes: { color: 'Rojo' } })
    const row = { ...original, attributes: { color: 'Azul' } }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([{ id: 'v1', changes: { attributes: { color: 'Azul' } } }])
  })

  it('trata {} y null como equivalentes en attributes (sin update)', () => {
    const original = makeRow({ id: 'v1', attributes: null })
    const row = { ...original, attributes: {} }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([])
  })

  it('ignora una fila con id que no está en originalsById', () => {
    const row = makeRow({ id: 'ghost' })
    const { inserts, updates } = buildVariantBatch([row], new Map())
    expect(inserts).toEqual([])
    expect(updates).toEqual([])
  })

  it('separa correctamente un batch mixto de inserts y updates', () => {
    const original = makeRow({ id: 'v1', stock: 1 })
    const unchanged = makeRow({ id: 'v2', stock: 2 })
    const draft = makeRow({ sku: 'NEW-1' })
    const rows = [{ ...original, stock: 9 }, unchanged, draft]
    const originalsById = new Map([['v1', original], ['v2', unchanged]])
    const { inserts, updates } = buildVariantBatch(rows, originalsById)
    expect(inserts).toHaveLength(1)
    expect(updates).toEqual([{ id: 'v1', changes: { stock: 9 } }])
  })

  it('retorna vacío para una grilla vacía', () => {
    expect(buildVariantBatch([], new Map())).toEqual({ inserts: [], updates: [] })
  })

  it('detecta cambio de image_url tras subir/reemplazar la imagen de la variante', () => {
    const original = makeRow({ id: 'v1', image_url: 'https://example.com/old.png' })
    const row = { ...original, image_url: 'https://example.com/new.png' }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([{ id: 'v1', changes: { image_url: 'https://example.com/new.png' } }])
  })

  it('detecta que se quitó la imagen (image_url a null)', () => {
    const original = makeRow({ id: 'v1', image_url: 'https://example.com/old.png' })
    const row = { ...original, image_url: null }
    const { updates } = buildVariantBatch([row], new Map([['v1', original]]))
    expect(updates).toEqual([{ id: 'v1', changes: { image_url: null } }])
  })
})
