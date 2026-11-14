import { describe, it, expect } from 'vitest'
import { STORE_HOURS, groupStoreHours, formatRanges, type DaySchedule } from './storeHours'

const open = (day: string, ranges: DaySchedule['ranges']): DaySchedule => ({ day, ranges })

describe('formatRanges', () => {
  it('retorna "Cerrado" cuando no hay franjas', () => {
    expect(formatRanges([])).toBe('Cerrado')
  })

  it('formatea una franja única', () => {
    expect(formatRanges([{ open: '9:00', close: '13:00' }])).toBe('9:00 a 13:00 h')
  })

  it('une franjas partidas con "y"', () => {
    expect(
      formatRanges([
        { open: '9:00', close: '12:30' },
        { open: '15:00', close: '19:30' },
      ]),
    ).toBe('9:00 a 12:30 y 15:00 a 19:30 h')
  })
})

describe('groupStoreHours', () => {
  it('retorna lista vacía para un horario vacío', () => {
    expect(groupStoreHours([])).toEqual([])
  })

  it('agrupa días consecutivos con el mismo horario como "A a B"', () => {
    const r = [{ open: '9:00', close: '12:00' }]
    const groups = groupStoreHours([open('Lunes', r), open('Martes', r), open('Miércoles', r)])
    expect(groups).toEqual([{ label: 'Lunes a miércoles', value: '9:00 a 12:00 h' }])
  })

  it('usa "A y B" cuando el grupo es de dos días', () => {
    const r = [{ open: '9:00', close: '12:00' }]
    expect(groupStoreHours([open('Lunes', r), open('Martes', r)])[0].label).toBe('Lunes y martes')
  })

  it('no agrupa días consecutivos con horarios distintos', () => {
    const groups = groupStoreHours([
      open('Sábado', [{ open: '9:00', close: '13:00' }]),
      open('Domingo', []),
    ])
    expect(groups).toEqual([
      { label: 'Sábado', value: '9:00 a 13:00 h' },
      { label: 'Domingo', value: 'Cerrado' },
    ])
  })

  it('no agrupa días no consecutivos aunque tengan el mismo horario', () => {
    const r = [{ open: '9:00', close: '12:00' }]
    const groups = groupStoreHours([open('Lunes', r), open('Martes', []), open('Miércoles', r)])
    expect(groups).toHaveLength(3)
  })

  it('agrupa días cerrados consecutivos', () => {
    const groups = groupStoreHours([open('Sábado', []), open('Domingo', [])])
    expect(groups).toEqual([{ label: 'Sábado y domingo', value: 'Cerrado' }])
  })
})

describe('STORE_HOURS', () => {
  it('define los 7 días de la semana empezando por lunes', () => {
    expect(STORE_HOURS).toHaveLength(7)
    expect(STORE_HOURS[0].day).toBe('Lunes')
    expect(STORE_HOURS[6].day).toBe('Domingo')
  })

  it('se agrupa en lunes a viernes, sábado y domingo', () => {
    expect(groupStoreHours(STORE_HOURS)).toEqual([
      { label: 'Lunes a viernes', value: '9:30 a 12:30 y 15:30 a 19:30 h' },
      { label: 'Sábado', value: '9:30 a 13:00 h' },
      { label: 'Domingo', value: 'Cerrado' },
    ])
  })
})
