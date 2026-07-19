import { usePublicStore } from '@/contexts/PublicStoreContext'
import type { Organization } from '@/types/database.types'

/**
 * Organización actual de la tienda pública (single-tenant por deploy).
 * Fork de un único cliente: ya no hay contexto admin, todo el árbol de
 * rutas está siempre dentro de PublicStoreProvider.
 */
export function useCurrentOrganization(): { organization: Organization | null } {
  const { organization } = usePublicStore()
  return { organization }
}
