/** Dominio canónico del sitio — apex sin `www` (ver nginx.conf: redirect 301 www → apex). */
export const DEFAULT_SITE_URL = 'https://ruemia.uy'

/**
 * Construye una URL absoluta para `path` sobre `baseUrl`. Colapsa cualquier
 * slash final de `baseUrl` para evitar dobles slashes, y agrega el slash
 * inicial a `path` si falta.
 *
 * Lógica pura (sin leer variables de entorno) — la usan tanto componentes
 * React (canonical/og:url) como el script Node de generación del sitemap
 * (`scripts/generate-sitemap.ts`), que corre fuera de Vite y no tiene acceso
 * a `import.meta.env`.
 */
export function buildAbsoluteUrl(path: string, baseUrl: string = DEFAULT_SITE_URL): string {
  const trimmedBase = (baseUrl ?? '').trim().replace(/\/+$/, '')
  const safeBase = trimmedBase || DEFAULT_SITE_URL
  const safePath = path ? (path.startsWith('/') ? path : `/${path}`) : '/'
  return `${safeBase}${safePath}`
}

/**
 * Lee `VITE_SITE_URL` del entorno de build (Vite) con fallback a
 * `DEFAULT_SITE_URL`.
 *
 * Importante: el acceso es siempre `import.meta.env.VITE_SITE_URL` directo
 * (con `?.` solo sobre `.env`, nunca envolviendo `import.meta` en un cast).
 * Vite reemplaza `import.meta.env` por un objeto en tiempo de transformación
 * y solo lo mantiene "vivo" (mutable, ej. por tests con `vi.stubEnv`) cuando
 * reconoce ese patrón textual exacto — envolver `import.meta` en un cast
 * (`(import.meta as unknown as {...}).env`) rompe esa detección y la lectura
 * queda congelada en `undefined` para siempre, aunque el valor real cambie.
 * Este acceso directo también es seguro fuera de Vite (Node puro, usado por
 * `scripts/generate-sitemap.ts`), porque ahí `import.meta.env` es
 * simplemente `undefined` y el `?.` corta la cadena sin tirar.
 */
export function getSiteUrl(): string {
  const raw = import.meta.env?.VITE_SITE_URL
  const trimmed = raw?.trim()
  return trimmed ? trimmed.replace(/\/+$/, '') : DEFAULT_SITE_URL
}

/** Helper de conveniencia para componentes: URL absoluta usando `VITE_SITE_URL`. */
export function absoluteUrl(path: string): string {
  return buildAbsoluteUrl(path, getSiteUrl())
}
