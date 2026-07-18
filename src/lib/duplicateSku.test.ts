import { describe, expect, it } from 'vitest'
import { generateDuplicateSku } from './duplicateSku'

describe('generateDuplicateSku', () => {
  it('agrega el sufijo -copia cuando no hay colisión', () => {
    expect(generateDuplicateSku('ABC-001', [])).toBe('ABC-001-copia')
  })

  it('agrega -copia-2 cuando -copia ya existe', () => {
    expect(generateDuplicateSku('ABC-001', ['ABC-001-copia'])).toBe('ABC-001-copia-2')
  })

  it('agrega -copia-3 cuando -copia y -copia-2 ya existen', () => {
    expect(generateDuplicateSku('ABC-001', ['ABC-001-copia', 'ABC-001-copia-2'])).toBe(
      'ABC-001-copia-3'
    )
  })

  it('devuelve el primer sufijo libre, no el siguiente al mayor existente (hueco en -copia-2)', () => {
    // -copia-2 está libre aunque -copia-3 ya exista: no hace falta llegar a -copia-4
    expect(generateDuplicateSku('ABC-001', ['ABC-001-copia', 'ABC-001-copia-3'])).toBe(
      'ABC-001-copia-2'
    )
  })

  it('ignora SKUs existentes que no comparten la base (no rompe con SKUs parecidos)', () => {
    expect(generateDuplicateSku('ABC-001', ['XYZ-002-copia', 'ABC-001-copia-99'])).toBe(
      'ABC-001-copia'
    )
  })

  it('recorta espacios del SKU base antes de generar el sufijo', () => {
    expect(generateDuplicateSku('  ABC-001  ', [])).toBe('ABC-001-copia')
  })

  it('recorta espacios de los SKUs existentes antes de comparar', () => {
    expect(generateDuplicateSku('ABC-001', ['  ABC-001-copia  '])).toBe('ABC-001-copia-2')
  })

  it('la comparación es sensible a mayúsculas/minúsculas, igual que el índice único de Postgres', () => {
    // "abc-001-copia" en minúscula no colisiona con "ABC-001-copia" en mayúscula
    expect(generateDuplicateSku('ABC-001', ['abc-001-copia'])).toBe('ABC-001-copia')
  })

  it('retorna vacío cuando el SKU base es una cadena vacía', () => {
    expect(generateDuplicateSku('', [])).toBe('')
  })

  it('retorna vacío cuando el SKU base contiene solo espacios', () => {
    expect(generateDuplicateSku('   ', [])).toBe('')
  })

  it('no falla si existingSkus contiene el SKU base sin el sufijo -copia', () => {
    // El SKU base por sí mismo (sin sufijo) no debe generar colisión con el candidato
    expect(generateDuplicateSku('ABC-001', ['ABC-001'])).toBe('ABC-001-copia')
  })
})
