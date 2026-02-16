import { useOrganizationStore } from '@/store/organizationStore'

/**
 * Obtiene el ID de la organización actual.
 * Lanza error si no hay organización seleccionada (para uso en admin).
 */
export function getCurrentOrganizationId(): string {
  const orgId = useOrganizationStore.getState().currentOrganization?.id
  if (!orgId) {
    throw new Error('No hay organización seleccionada. Por favor, selecciona una organización.')
  }
  return orgId
}

/**
 * Obtiene el ID de la organización actual o null si no hay una seleccionada.
 */
export function getCurrentOrganizationIdOrNull(): string | null {
  return useOrganizationStore.getState().currentOrganization?.id ?? null
}
