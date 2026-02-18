import { useMemo } from 'react'
import { useOrganizationStore } from '@/store/organizationStore'
import type { OrganizationSettings } from '@/types/database.types'

const DEFAULT_SETTINGS: Required<Pick<OrganizationSettings, 'currency' | 'locale' | 'timezone' | 'decimal_places'>> = {
  currency: 'ARS',
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  decimal_places: 2,
}

/**
 * Returns organization settings for formatting (currency, locale, timezone).
 * Uses current organization from store. Falls back to defaults when no org or no settings.
 */
export function useOrgSettings(): OrganizationSettings {
  const currentOrganization = useOrganizationStore((s) => s.currentOrganization)

  return useMemo(() => {
    const raw = currentOrganization?.settings
    const settings = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>

    return {
      currency: (settings.currency as string) ?? DEFAULT_SETTINGS.currency,
      locale: (settings.locale as string) ?? DEFAULT_SETTINGS.locale,
      timezone: (settings.timezone as string) ?? DEFAULT_SETTINGS.timezone,
      decimal_places: typeof settings.decimal_places === 'number' ? settings.decimal_places : DEFAULT_SETTINGS.decimal_places,
      allow_negative_stock: (settings.allow_negative_stock as boolean) !== false,
    }
  }, [currentOrganization?.id, currentOrganization?.settings])
}
