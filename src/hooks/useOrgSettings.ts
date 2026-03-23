import { useMemo } from 'react'
import { useOrganizationStore } from '@/store/organizationStore'
import type { OrganizationSettings } from '@/types/database.types'

const DEFAULT_SETTINGS: Required<Pick<OrganizationSettings, 'currency' | 'locale' | 'timezone' | 'decimal_places'>> = {
  currency: 'ARS',
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  decimal_places: 0,
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
    const checkoutFulfillmentMode = settings.checkout_fulfillment_mode === 'main' ? 'main' : 'auto'
    const checkoutStockAllocationMode = settings.checkout_stock_allocation_mode === 'manual' ? 'manual' : 'immediate'
    const inventoryTransferCompletionMode =
      settings.inventory_transfer_completion_mode === 'automatic' ? 'automatic' : 'manual'

    return {
      currency: (settings.currency as string) ?? DEFAULT_SETTINGS.currency,
      locale: (settings.locale as string) ?? DEFAULT_SETTINGS.locale,
      timezone: (settings.timezone as string) ?? DEFAULT_SETTINGS.timezone,
      decimal_places: typeof settings.decimal_places === 'number' ? settings.decimal_places : DEFAULT_SETTINGS.decimal_places,
      allow_negative_stock: (settings.allow_negative_stock as boolean) !== false,
      default_low_stock_threshold:
        typeof settings.default_low_stock_threshold === 'number'
          ? Math.max(0, Math.trunc(settings.default_low_stock_threshold))
          : 10,
      consignment_enabled: (settings.consignment_enabled as boolean) ?? false,
      consignment_allow_seller_to_seller: (settings.consignment_allow_seller_to_seller as boolean) ?? false,
      consignment_default_warehouse_branch_id:
        typeof settings.consignment_default_warehouse_branch_id === 'string'
          ? settings.consignment_default_warehouse_branch_id
          : null,
      checkout_fulfillment_mode: checkoutFulfillmentMode,
      checkout_exclude_isolated_warehouses: (settings.checkout_exclude_isolated_warehouses as boolean) !== false,
      checkout_stock_allocation_mode: checkoutStockAllocationMode,
      inventory_transfer_completion_mode: inventoryTransferCompletionMode,
    }
  }, [currentOrganization?.id, currentOrganization?.settings])
}
