import { PublicStoreContext } from '@/contexts/PublicStoreContext'
import { useOrganizationStore } from '@/store/organizationStore'
import type { Organization } from '@/types/database.types'
import { useContext } from 'react'

/**
 * Hook que retorna la organización actual según el contexto:
 * - Si estamos en tienda pública (PublicStoreProvider), usa usePublicStore
 * - Si estamos en admin, usa useOrganizationStore
 */
export function useCurrentOrganization(): {
  organization: Organization | null
  slug: string | null
  isPublicStore: boolean
} {
  const publicStoreContext = useContext(PublicStoreContext)
  
  if (publicStoreContext) {
    // Estamos en contexto de tienda pública
    return {
      organization: publicStoreContext.organization,
      slug: publicStoreContext.slug,
      isPublicStore: true,
    }
  }
  
  // Estamos en contexto admin
  const currentOrg = useOrganizationStore((s) => s.currentOrganization)
  return {
    organization: currentOrg,
    slug: currentOrg?.slug ?? null,
    isPublicStore: false,
  }
}
