import { describe, expect, it } from 'vitest'
import { SPLASH_MIN_MS, getSplashRemainingMs } from './splash'

describe('getSplashRemainingMs', () => {
  it('retorna el tiempo que falta para cumplir el mínimo', () => {
    expect(getSplashRemainingMs(300)).toBe(SPLASH_MIN_MS - 300)
  })

  it('retorna 0 justo al cumplir el mínimo', () => {
    expect(getSplashRemainingMs(SPLASH_MIN_MS)).toBe(0)
  })

  it('retorna 0 cuando ya pasó el mínimo (la carga real fue más lenta)', () => {
    expect(getSplashRemainingMs(SPLASH_MIN_MS + 1)).toBe(0)
  })

  it('retorna el mínimo completo con 0 ms transcurridos', () => {
    expect(getSplashRemainingMs(0)).toBe(SPLASH_MIN_MS)
  })

  it('no supera el mínimo con un tiempo transcurrido negativo', () => {
    expect(getSplashRemainingMs(-50)).toBe(SPLASH_MIN_MS)
  })

  it('retorna el mínimo completo con un tiempo transcurrido NaN', () => {
    expect(getSplashRemainingMs(Number.NaN)).toBe(SPLASH_MIN_MS)
  })

  it('respeta un mínimo personalizado', () => {
    expect(getSplashRemainingMs(200, 500)).toBe(300)
  })
})
