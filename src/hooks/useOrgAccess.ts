import { useOrganizationStore } from '@/store/organizationStore'
import { getOrgAccessStatus, type OrgAccessInfo } from '@/lib/orgAccess'

export function useOrgAccess(): OrgAccessInfo {
  const org = useOrganizationStore((s) => s.currentOrganization)
  return getOrgAccessStatus(org)
}
