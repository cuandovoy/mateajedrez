import { useOrgSettings } from '@/hooks/useOrgSettings'

type OrgFeatureKey = 'consignment_enabled' | 'consignment_allow_seller_to_seller'

export function useOrgFeature(feature: OrgFeatureKey): boolean {
  const settings = useOrgSettings()
  return Boolean(settings[feature])
}
