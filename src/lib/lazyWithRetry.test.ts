import { describe, expect, it, vi } from 'vitest'
import { importWithRetry, RELOAD_FLAG_KEY } from './lazyWithRetry'

function createStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem: vi.fn((k: string) => (k in data ? data[k] : null)),
    setItem: vi.fn((k: string, v: string) => {
      data[k] = v
    }),
    removeItem: vi.fn((k: string) => {
      delete data[k]
    }),
  }
}

describe('importWithRetry', () => {
  it('retorna el módulo cuando el import funciona', async () => {
    const mod = { Page: () => null }
    const reload = vi.fn()
    const result = await importWithRetry(() => Promise.resolve(mod), { storage: createStorage(), reload })
    expect(result).toBe(mod)
    expect(reload).not.toHaveBeenCalled()
  })

  it('limpia el flag de recarga cuando el import funciona (permite reintentar en un deploy futuro)', async () => {
    const storage = createStorage({ [RELOAD_FLAG_KEY]: '1' })
    await importWithRetry(() => Promise.resolve({}), { storage, reload: vi.fn() })
    expect(storage.removeItem).toHaveBeenCalledWith(RELOAD_FLAG_KEY)
  })

  it('recarga la página una vez y marca el flag cuando el import falla por primera vez', async () => {
    const storage = createStorage()
    const reload = vi.fn()
    // La promesa queda pendiente a propósito: la página se está recargando, no hay nada que renderizar.
    const pending = importWithRetry(() => Promise.reject(new Error('chunk viejo')), { storage, reload })
    await new Promise((r) => setTimeout(r, 0))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(RELOAD_FLAG_KEY, '1')
    const settled = await Promise.race([pending.then(() => 'resolved', () => 'rejected'), Promise.resolve('pending')])
    expect(settled).toBe('pending')
  })

  it('relanza el error original sin recargar si ya se recargó antes', async () => {
    const storage = createStorage({ [RELOAD_FLAG_KEY]: '1' })
    const reload = vi.fn()
    const error = new Error('sigue fallando')
    await expect(importWithRetry(() => Promise.reject(error), { storage, reload })).rejects.toBe(error)
    expect(reload).not.toHaveBeenCalled()
  })

  it('resuelve al módulo fallback en vez de lanzar si ya se recargó antes', async () => {
    const storage = createStorage({ [RELOAD_FLAG_KEY]: '1' })
    const reload = vi.fn()
    const fallback = { fallback: true }
    const result = await importWithRetry(() => Promise.reject(new Error('sigue fallando')), {
      storage,
      reload,
      fallback: () => fallback,
    })
    expect(result).toBe(fallback)
    expect(reload).not.toHaveBeenCalled()
  })

  it('resuelve al módulo fallback si sessionStorage no está disponible', async () => {
    const fail = () => {
      throw new Error('blocked')
    }
    const fallback = { fallback: true }
    const result = await importWithRetry(() => Promise.reject(new Error('x')), {
      storage: { getItem: fail, setItem: fail, removeItem: fail },
      reload: vi.fn(),
      fallback: () => fallback,
    })
    expect(result).toBe(fallback)
  })

  it('con fallback, la primera falla sigue recargando en vez de mostrar el fallback', async () => {
    const reload = vi.fn()
    const fallback = vi.fn(() => ({}))
    void importWithRetry(() => Promise.reject(new Error('x')), { storage: createStorage(), reload, fallback })
    await new Promise((r) => setTimeout(r, 0))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('relanza el error si sessionStorage no está disponible (evita loops de recarga)', async () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const reload = vi.fn()
    const error = new Error('chunk viejo')
    await expect(importWithRetry(() => Promise.reject(error), { storage, reload })).rejects.toBe(error)
    expect(reload).not.toHaveBeenCalled()
  })

  it('no falla en un import exitoso aunque sessionStorage lance al limpiar el flag', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    await expect(importWithRetry(() => Promise.resolve({ ok: true }), { storage, reload: vi.fn() })).resolves.toEqual({ ok: true })
  })
})
