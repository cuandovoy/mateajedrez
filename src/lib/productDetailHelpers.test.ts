import { describe, it, expect } from 'vitest'
import { calcWeightedAvgCost, calcMargin } from './productDetailHelpers'

// ─── calcWeightedAvgCost ──────────────────────────────────────────────────────

describe('calcWeightedAvgCost', () => {
  // ── Happy path ───────────────────────────────────────────────────────────

  it('retorna el promedio ponderado correcto con dos sucursales con stock y costo', () => {
    // (10 * 100 + 20 * 200) / 30 = 5000 / 30 ≈ 166.67
    const result = calcWeightedAvgCost([
      { stock: 10, cost: 100 },
      { stock: 20, cost: 200 },
    ])
    expect(result).toBeCloseTo(166.67, 2)
  })

  // ── Single branch ────────────────────────────────────────────────────────

  it('retorna el costo exacto cuando hay una sola sucursal', () => {
    const result = calcWeightedAvgCost([{ stock: 5, cost: 300 }])
    expect(result).toBe(300)
  })

  // ── All-zero stock → null ────────────────────────────────────────────────

  it('retorna null cuando todas las sucursales tienen stock 0', () => {
    const result = calcWeightedAvgCost([
      { stock: 0, cost: 100 },
      { stock: 0, cost: 200 },
    ])
    expect(result).toBeNull()
  })

  it('retorna null cuando el array está vacío', () => {
    const result = calcWeightedAvgCost([])
    expect(result).toBeNull()
  })

  // ── One branch with zero stock ───────────────────────────────────────────

  it('ignora la sucursal con stock 0 y usa solo la que tiene stock positivo', () => {
    // Solo la segunda contribuye: (0 * 999 + 10 * 50) / 10 = 50
    const result = calcWeightedAvgCost([
      { stock: 0, cost: 999 },
      { stock: 10, cost: 50 },
    ])
    expect(result).toBe(50)
  })

  // ── Null / undefined cost ────────────────────────────────────────────────

  it('trata costo null como 0 en el promedio ponderado', () => {
    // (10 * 0 + 10 * 200) / 20 = 100
    const result = calcWeightedAvgCost([
      { stock: 10, cost: null },
      { stock: 10, cost: 200 },
    ])
    expect(result).toBe(100)
  })

  it('trata costo undefined como 0 en el promedio ponderado', () => {
    // (5 * 0 + 5 * 100) / 10 = 50
    const result = calcWeightedAvgCost([
      { stock: 5, cost: undefined },
      { stock: 5, cost: 100 },
    ])
    expect(result).toBe(50)
  })

  it('retorna null cuando todos los costos son null y el stock es 0', () => {
    const result = calcWeightedAvgCost([{ stock: 0, cost: null }])
    expect(result).toBeNull()
  })

  it('retorna 0 cuando todos los costos son null pero hay stock positivo', () => {
    // (10 * 0) / 10 = 0
    const result = calcWeightedAvgCost([{ stock: 10, cost: null }])
    expect(result).toBe(0)
  })

  // ── Null / undefined stock ───────────────────────────────────────────────

  it('trata stock null como 0 (no contribuye al total)', () => {
    // Solo la segunda: stock total = 5, costo = (0 * 100 + 5 * 200) / 5 = 200
    const result = calcWeightedAvgCost([
      { stock: null, cost: 100 },
      { stock: 5, cost: 200 },
    ])
    expect(result).toBe(200)
  })
})

// ─── calcMargin ───────────────────────────────────────────────────────────────

describe('calcMargin', () => {
  // ── Green threshold ──────────────────────────────────────────────────────

  it('retorna green para margen ≥ 40%', () => {
    // precio 100, costo 50 → margen = 50%
    const { pct, color } = calcMargin(100, 50)
    expect(color).toBe('green')
    expect(pct).toBeCloseTo(50)
  })

  it('retorna green exactamente en el límite inferior del rango green (40%)', () => {
    // precio 100, costo 60 → margen = 40%
    const { pct, color } = calcMargin(100, 60)
    expect(color).toBe('green')
    expect(pct).toBeCloseTo(40)
  })

  // ── Yellow threshold ─────────────────────────────────────────────────────

  it('retorna yellow para margen en rango 20–39.9%', () => {
    // precio 100, costo 70 → margen = 30%
    const { pct, color } = calcMargin(100, 70)
    expect(color).toBe('yellow')
    expect(pct).toBeCloseTo(30)
  })

  it('retorna yellow exactamente en el límite inferior del rango yellow (20%)', () => {
    // precio 100, costo 80 → margen = 20%
    const { pct, color } = calcMargin(100, 80)
    expect(color).toBe('yellow')
    expect(pct).toBeCloseTo(20)
  })

  it('retorna yellow exactamente en el límite superior del rango yellow (39.9%)', () => {
    // precio 1000, costo 601 → margen ≈ 39.9%
    const { pct, color } = calcMargin(1000, 601)
    expect(color).toBe('yellow')
    expect(pct).toBeCloseTo(39.9)
  })

  // ── Red threshold ────────────────────────────────────────────────────────

  it('retorna red para margen < 20%', () => {
    // precio 100, costo 85 → margen = 15%
    const { pct, color } = calcMargin(100, 85)
    expect(color).toBe('red')
    expect(pct).toBeCloseTo(15)
  })

  it('retorna red exactamente en el límite superior del rango red (19.9%)', () => {
    // precio 1000, costo 801 → margen ≈ 19.9%
    const { pct, color } = calcMargin(1000, 801)
    expect(color).toBe('red')
    expect(pct).toBeCloseTo(19.9)
  })

  // ── Negative margin ──────────────────────────────────────────────────────

  it('retorna red para margen negativo (costo mayor al precio)', () => {
    // precio 100, costo 120 → margen = -20%
    const { pct, color } = calcMargin(100, 120)
    expect(color).toBe('red')
    expect(pct).toBeCloseTo(-20)
  })

  // ── Zero price guard ─────────────────────────────────────────────────────

  it('retorna null cuando el precio es 0 (guarda división por cero)', () => {
    const { pct, color } = calcMargin(0, 50)
    expect(pct).toBeNull()
    expect(color).toBeNull()
  })

  // ── Null cost guard ──────────────────────────────────────────────────────

  it('retorna null cuando el costo es null (costo desconocido)', () => {
    const { pct, color } = calcMargin(100, null)
    expect(pct).toBeNull()
    expect(color).toBeNull()
  })

  // ── Zero cost, positive price ────────────────────────────────────────────

  it('retorna green con pct=100 cuando el costo es 0 y el precio es positivo', () => {
    // precio 100, costo 0 → margen = 100%
    const { pct, color } = calcMargin(100, 0)
    expect(color).toBe('green')
    expect(pct).toBeCloseTo(100)
  })

  // ── Both zero ────────────────────────────────────────────────────────────

  it('retorna null cuando precio y costo son ambos 0 (guarda división por cero)', () => {
    const { pct, color } = calcMargin(0, 0)
    expect(pct).toBeNull()
    expect(color).toBeNull()
  })
})
