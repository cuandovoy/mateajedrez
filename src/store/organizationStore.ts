import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Organization, OrganizationMember } from '@/types/database.types'
import type { OrgRoleResolved } from '@/types'
import type { Permission } from '@/lib/permissions'

const STORAGE_KEY = 'organization-store'

/** Regex to validate the 16 module-permission keys: {module}:(ver|gestionar) */
const MODULE_PERMISSION_RE = /^[a-z]+:(ver|gestionar)$/

/** Filter a raw array of permission keys down to the valid 16 module keys */
function toModulePermissions(keys: string[]): Permission[] {
  return keys.filter((k) => MODULE_PERMISSION_RE.test(k)) as Permission[]
}

type OrganizationWithMember = Organization & {
  member?: OrganizationMember & {
    organization_role_id?: string | null
    base_role_key?: string | null
    permissions?: Permission[]
  }
}

interface OrganizationState {
  currentOrganization: Organization | null
  organizations: OrganizationWithMember[]
  loading: boolean
  switchingOrganization: boolean
  error: string | null
  /** The resolved org-role for the current user in the active org */
  orgRole: OrgRoleResolved | null
  /** True while fetchOrganizations is loading (permissions not yet resolved) */
  orgRoleLoading: boolean
  setCurrentOrganization: (org: Organization | null) => void
  fetchOrganizations: () => Promise<void>
  fetchOrgBySlug: (slug: string) => Promise<Organization | null>
  clear: () => void
}

/** Derive OrgRoleResolved from a loaded org entry */
function deriveOrgRole(org: OrganizationWithMember | undefined): OrgRoleResolved | null {
  if (!org?.member) return null
  const m = org.member
  return {
    roleId: m.organization_role_id ?? null,
    baseRoleKey: (m.base_role_key as OrgRoleResolved['baseRoleKey']) ?? null,
    permissions: m.permissions ?? [],
  }
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      currentOrganization: null,
      organizations: [],
      loading: false,
      switchingOrganization: false,
      error: null,
      orgRole: null,
      orgRoleLoading: false,

      setCurrentOrganization: (org) => {
        set({ currentOrganization: org, switchingOrganization: true })
        // Re-derive orgRole synchronously from cached organizations (no new fetch needed)
        if (org) {
          const { organizations } = get()
          const matched = organizations.find((o) => o.id === org.id)
          set({ orgRole: deriveOrgRole(matched) })
        } else {
          set({ orgRole: null })
        }
        setTimeout(() => set({ switchingOrganization: false }), 600)
      },

      fetchOrganizations: async () => {
        set({ loading: true, orgRoleLoading: true, error: null })
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            set({ organizations: [], currentOrganization: null, loading: false, orgRole: null, orgRoleLoading: false })
            return
          }

          // Step 1: fetch memberships + org data + role metadata
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any
          const { data: members, error: membersError } = await sb
            .from('organization_members')
            .select(`
              id,
              role,
              organization_id,
              organization_role_id,
              organization_roles(base_role_key, is_active),
              organizations(id, name, slug, logo_url, cover_image_url, primary_color, secondary_color, accent_color, font_family, font_heading, border_radius, button_style, settings, subscription_tier, subscription_status, trial_ends_at, subscription_expires_at, created_at, updated_at, deleted_at)
            `)
            .eq('user_id', user.id)

          if (membersError) throw membersError

          // Step 2: fetch permission keys for all role IDs in one query
          const roleIds = (members || [])
            .map((m: { organization_role_id: string | null }) => m.organization_role_id)
            .filter(Boolean) as string[]

          let permsByRoleId = new Map<string, Permission[]>()
          if (roleIds.length > 0) {
            const { data: rolePermsData, error: rolePermsError } = await sb
              .from('organization_role_permissions')
              .select('organization_role_id, permissions(key)')
              .in('organization_role_id', roleIds)

            if (rolePermsError) throw rolePermsError

            ;(rolePermsData || []).forEach((rp: { organization_role_id: string; permissions: { key: string } | null }) => {
              if (!rp.permissions?.key) return
              const list = permsByRoleId.get(rp.organization_role_id) ?? []
              list.push(rp.permissions.key as Permission)
              permsByRoleId.set(rp.organization_role_id, list)
            })

            // Filter each role's keys to module-only
            for (const [roleId, keys] of permsByRoleId.entries()) {
              permsByRoleId.set(roleId, toModulePermissions(keys))
            }
          }

          // Step 3: build enriched OrganizationWithMember array
          const orgs: OrganizationWithMember[] = (members || [])
            .filter((m: { organizations: unknown }) => m.organizations != null)
            .map((m: {
              role: string
              organization_role_id: string | null
              organization_roles: { base_role_key: string | null; is_active: boolean } | null
              organizations: Record<string, unknown>
            }) => {
              const baseRoleKey = m.organization_roles?.base_role_key ?? null
              const orgRoleId = m.organization_role_id ?? null
              const permissions = orgRoleId ? (permsByRoleId.get(orgRoleId) ?? []) : []

              return {
                ...m.organizations,
                member: {
                  role: m.role,
                  organization_role_id: orgRoleId,
                  base_role_key: baseRoleKey,
                  permissions,
                } as OrganizationMember & {
                  organization_role_id: string | null
                  base_role_key: string | null
                  permissions: Permission[]
                },
              }
            })
            .filter((o: OrganizationWithMember) => !o.deleted_at)

          set({ organizations: orgs })

          // Step 4: determine currentOrganization and derive orgRole
          const { currentOrganization } = get()
          let nextCurrentOrg: Organization | null = null

          if (orgs.length > 0 && !currentOrganization) {
            nextCurrentOrg = orgs[0]
          } else if (orgs.length > 0 && currentOrganization) {
            const stillMember = orgs.some((o) => o.id === currentOrganization.id)
            nextCurrentOrg = stillMember ? currentOrganization : orgs[0]
          }

          if (nextCurrentOrg) {
            const matched = orgs.find((o) => o.id === nextCurrentOrg!.id)
            set({
              currentOrganization: nextCurrentOrg,
              orgRole: deriveOrgRole(matched),
            })
          } else {
            set({ currentOrganization: null, orgRole: null })
          }
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Error al cargar organizaciones',
            organizations: [],
            currentOrganization: null,
            orgRole: null,
          })
        } finally {
          set({ loading: false, orgRoleLoading: false })
        }
      },

      fetchOrgBySlug: async (slug: string) => {
        try {
          const { data, error } = await supabase.rpc('get_org_by_slug' as never, { p_slug: slug } as never)
          if (error || !data) return null
          const row = (Array.isArray(data) ? data[0] : data) as {
            id: string
            name: string
            slug: string
            logo_url?: string | null
            cover_image_url?: string | null
            primary_color?: string | null
            secondary_color?: string | null
            accent_color?: string | null
            font_family?: string | null
            font_heading?: string | null
            border_radius?: string | null
            button_style?: string | null
            settings?: Record<string, unknown> | null
          } | undefined
          if (!row?.id) return null
          return {
            ...row,
            settings: row.settings ?? {},
            subscription_tier: (row as Record<string, unknown>).subscription_tier as string ?? 'starter',
            subscription_status: (row as Record<string, unknown>).subscription_status as string ?? 'trialing',
            trial_ends_at: (row as Record<string, unknown>).trial_ends_at as string ?? null,
            subscription_expires_at: (row as Record<string, unknown>).subscription_expires_at as string ?? null,
          } as Organization
        } catch {
          return null
        }
      },

      clear: () => {
        set({
          currentOrganization: null,
          organizations: [],
          error: null,
          orgRole: null,
          orgRoleLoading: false,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        currentOrganization: state.currentOrganization,
      }),
    }
  )
)
