import { useEffect } from 'react'
import { useOrganizationStore } from '@/store/organizationStore'

/**
 * Hook para acceder a la organización actual y cargar organizaciones al montar.
 * Usar en componentes que necesitan el organization_id para queries.
 */
export function useOrganization() {
  const {
    currentOrganization,
    organizations,
    loading,
    error,
    setCurrentOrganization,
    fetchOrganizations,
  } = useOrganizationStore()

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  return {
    organization: currentOrganization,
    organizationId: currentOrganization?.id ?? null,
    organizations,
    loading,
    error,
    setCurrentOrganization,
    isAdmin: organizations.find((o) => o.id === currentOrganization?.id)?.member?.role === 'admin',
    isManager: ['admin', 'manager'].includes(
      organizations.find((o) => o.id === currentOrganization?.id)?.member?.role ?? ''
    ),
  }
}
