import { lazy } from 'react'
import type { ComponentType } from 'react'
import { ChunkLoadErrorFallback } from '@/components/ui/ChunkLoadErrorFallback'
import { RELOAD_FLAG_KEY } from './chunkReload'

export { RELOAD_FLAG_KEY }

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface RetryDeps {
  storage: StorageLike
  reload: () => void
  // Si se pasa, reemplaza al throw cuando ya no quedan reintentos (ej. un componente de error).
  fallback?: () => unknown
}

// Tras un deploy, el index.html cacheado puede apuntar a chunks con hash que ya no
// existen: el import dinámico falla. Se recarga UNA vez (el flag en sessionStorage
// evita loops) para traer el HTML nuevo; si vuelve a fallar se usa `fallback` (o se
// relanza el error si no hay).
export async function importWithRetry<T>(factory: () => Promise<T>, deps: RetryDeps): Promise<T> {
  try {
    const mod = await factory()
    try {
      deps.storage.removeItem(RELOAD_FLAG_KEY)
    } catch {
      // sessionStorage bloqueado: no afecta al import ya resuelto.
    }
    return mod
  } catch (error) {
    let alreadyReloaded = true
    try {
      alreadyReloaded = deps.storage.getItem(RELOAD_FLAG_KEY) === '1'
      if (!alreadyReloaded) deps.storage.setItem(RELOAD_FLAG_KEY, '1')
    } catch {
      // Sin storage no se puede garantizar una sola recarga: mejor relanzar que arriesgar un loop.
      alreadyReloaded = true
    }
    if (alreadyReloaded) {
      if (deps.fallback) return deps.fallback() as T
      throw error
    }
    deps.reload()
    // La página se está recargando: dejar la promesa pendiente evita parpadear un error.
    return new Promise<T>(() => {})
  }
}

// Acceder a window.sessionStorage puede lanzar SecurityError (cookies/storage bloqueados).
function getSessionStorage(): StorageLike {
  try {
    return window.sessionStorage
  } catch {
    const fail = () => {
      throw new Error('sessionStorage no disponible')
    }
    return { getItem: fail, setItem: fail, removeItem: fail }
  }
}

export function lazyWithRetry<M extends Record<string, unknown>, K extends keyof M>(
  factory: () => Promise<M>,
  exportName: K
) {
  return lazy(async () => {
    const mod = await importWithRetry(factory, {
      storage: getSessionStorage(),
      reload: () => window.location.reload(),
      fallback: () => ({ default: ChunkLoadErrorFallback }),
    })
    return { default: ((mod as Record<PropertyKey, unknown>)[exportName] ?? (mod as { default?: unknown }).default) as ComponentType<Record<string, never>> }
  })
}
