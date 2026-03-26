import { describe, it, expect } from 'vitest'
import { productSchema, categorySchema, branchSchema, supplierSchema } from './schemas'

// ─── productSchema ────────────────────────────────────────────────────────────

describe('productSchema', () => {
  const valid = {
    name: 'Remera Básica',
    price: 1500,
    stock: 10,
    category_id: 'cat-uuid-123',
    sku: 'REM-001',
    is_active: true,
  }

  it('acepta un producto válido', () => {
    expect(productSchema.safeParse(valid).success).toBe(true)
  })

  it('acepta descripción opcional ausente', () => {
    const { description: _, ...noDesc } = { ...valid, description: undefined }
    expect(productSchema.safeParse(noDesc).success).toBe(true)
  })

  it('rechaza nombre vacío', () => {
    const result = productSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El nombre es requerido')
    }
  })

  it('rechaza precio negativo', () => {
    const result = productSchema.safeParse({ ...valid, price: -1 })
    expect(result.success).toBe(false)
  })

  it('acepta precio 0', () => {
    expect(productSchema.safeParse({ ...valid, price: 0 }).success).toBe(true)
  })

  it('rechaza stock negativo', () => {
    const result = productSchema.safeParse({ ...valid, stock: -5 })
    expect(result.success).toBe(false)
  })

  it('acepta stock 0', () => {
    expect(productSchema.safeParse({ ...valid, stock: 0 }).success).toBe(true)
  })

  it('rechaza category_id vacío', () => {
    const result = productSchema.safeParse({ ...valid, category_id: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('La categoría es requerida')
    }
  })

  it('rechaza sku vacío', () => {
    const result = productSchema.safeParse({ ...valid, sku: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El SKU es requerido')
    }
  })

  it('aplica default is_active = true si no se provee', () => {
    const result = productSchema.safeParse({ ...valid, is_active: undefined })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.is_active).toBe(true)
  })
})

// ─── categorySchema ───────────────────────────────────────────────────────────

describe('categorySchema', () => {
  const valid = {
    name: 'Ropa',
    slug: 'ropa',
  }

  it('acepta una categoría válida', () => {
    expect(categorySchema.safeParse(valid).success).toBe(true)
  })

  it('rechaza nombre vacío', () => {
    const result = categorySchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza slug vacío', () => {
    const result = categorySchema.safeParse({ ...valid, slug: '' })
    expect(result.success).toBe(false)
  })

  it('acepta image_url vacío (string literal)', () => {
    expect(categorySchema.safeParse({ ...valid, image_url: '' }).success).toBe(true)
  })

  it('acepta image_url como URL válida', () => {
    expect(categorySchema.safeParse({ ...valid, image_url: 'https://example.com/img.jpg' }).success).toBe(true)
  })

  it('rechaza image_url con texto que no es URL ni vacío', () => {
    const result = categorySchema.safeParse({ ...valid, image_url: 'no-es-url' })
    expect(result.success).toBe(false)
  })

  it('acepta parent_id vacío (subcategoría sin padre)', () => {
    expect(categorySchema.safeParse({ ...valid, parent_id: '' }).success).toBe(true)
  })

  it('acepta parent_id con UUID', () => {
    expect(categorySchema.safeParse({ ...valid, parent_id: 'parent-uuid-abc' }).success).toBe(true)
  })
})

// ─── branchSchema ─────────────────────────────────────────────────────────────

describe('branchSchema', () => {
  const valid = {
    name: 'Sucursal Centro',
    kind: 'store' as const,
    is_active: true,
    can_dispatch: true,
    can_receive: true,
    can_sell: true,
    is_isolated_warehouse: false,
  }

  it('acepta una sucursal válida', () => {
    expect(branchSchema.safeParse(valid).success).toBe(true)
  })

  it('rechaza nombre vacío', () => {
    const result = branchSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('acepta kind = warehouse', () => {
    expect(branchSchema.safeParse({ ...valid, kind: 'warehouse' }).success).toBe(true)
  })

  it('acepta kind = seller', () => {
    expect(branchSchema.safeParse({ ...valid, kind: 'seller' }).success).toBe(true)
  })

  it('rechaza kind inválido', () => {
    const result = branchSchema.safeParse({ ...valid, kind: 'deposito' })
    expect(result.success).toBe(false)
  })

  it('acepta email válido', () => {
    expect(branchSchema.safeParse({ ...valid, email: 'sucursal@tienda.com' }).success).toBe(true)
  })

  it('acepta email vacío (literal)', () => {
    expect(branchSchema.safeParse({ ...valid, email: '' }).success).toBe(true)
  })

  it('rechaza email con formato inválido', () => {
    const result = branchSchema.safeParse({ ...valid, email: 'no-es-un-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email inválido')
    }
  })

  it('aplica country = Uruguay por defecto', () => {
    const result = branchSchema.safeParse({ ...valid })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.country).toBe('Uruguay')
  })

  it('aplica kind = store por defecto', () => {
    const { kind: _, ...noKind } = valid
    const result = branchSchema.safeParse(noKind)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.kind).toBe('store')
  })
})

// ─── supplierSchema ───────────────────────────────────────────────────────────

describe('supplierSchema', () => {
  const valid = {
    name: 'Proveedor SA',
    phone: '91234567',
    tax_id: '219999990018',
    is_active: true,
  }

  it('acepta un proveedor válido', () => {
    expect(supplierSchema.safeParse(valid).success).toBe(true)
  })

  it('acepta teléfono con prefijo +598', () => {
    expect(supplierSchema.safeParse({ ...valid, phone: '+59891234567' }).success).toBe(true)
  })

  it('rechaza nombre vacío', () => {
    const result = supplierSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza teléfono vacío', () => {
    const result = supplierSchema.safeParse({ ...valid, phone: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza teléfono con formato inválido', () => {
    const result = supplierSchema.safeParse({ ...valid, phone: '12345' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Teléfono inválido')
    }
  })

  it('rechaza RUT vacío', () => {
    const result = supplierSchema.safeParse({ ...valid, tax_id: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza RUT con formato inválido', () => {
    const result = supplierSchema.safeParse({ ...valid, tax_id: '123abc' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('RUT inválido')
    }
  })

  it('acepta RUT con puntos y guión', () => {
    expect(supplierSchema.safeParse({ ...valid, tax_id: '21.999999.001-8' }).success).toBe(true)
  })

  it('acepta email vacío (literal)', () => {
    expect(supplierSchema.safeParse({ ...valid, email: '' }).success).toBe(true)
  })

  it('rechaza email con formato inválido', () => {
    const result = supplierSchema.safeParse({ ...valid, email: 'no-email' })
    expect(result.success).toBe(false)
  })

  it('acepta website vacío (literal)', () => {
    expect(supplierSchema.safeParse({ ...valid, website: '' }).success).toBe(true)
  })

  it('acepta website como URL válida', () => {
    expect(supplierSchema.safeParse({ ...valid, website: 'https://proveedor.com' }).success).toBe(true)
  })

  it('rechaza website con texto que no es URL', () => {
    const result = supplierSchema.safeParse({ ...valid, website: 'no-es-url' })
    expect(result.success).toBe(false)
  })
})
