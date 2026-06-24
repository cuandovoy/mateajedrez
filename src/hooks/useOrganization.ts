import { useEffect } from 'react'
import { useOrganizationStore } from '@/store/organizationStore'

/**
 * Hook para acceder a la organización actual y cargar organizaciones al montar.
 * Usar en componentes que necesitan el organization_id para queries.
 *
 * isAdmin and isManager derive from the org-scoped role (base_role_key),
 * not from the legacy role string on organization_members.
 */
export function useOrganization() {
  const {
    currentOrganization,
    organizations,
    loading,
    error,
    setCurrentOrganization,
    fetchOrganizations,
    orgRole,
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
    isAdmin: orgRole?.baseRoleKey === 'admin',
    isManager: ['admin', 'manager'].includes(orgRole?.baseRoleKey ?? ''),
  }
}
