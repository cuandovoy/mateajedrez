import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Organization, OrganizationMember } from '@/types/database.types'

const STORAGE_KEY = 'organization-store'

type OrganizationWithMember = Organization & {
  member?: OrganizationMember
}

interface OrganizationState {
  currentOrganization: Organization | null
  organizations: OrganizationWithMember[]
  loading: boolean
  switchingOrganization: boolean
  error: string | null
  setCurrentOrganization: (org: Organization | null) => void
  fetchOrganizations: () => Promise<void>
  fetchOrgBySlug: (slug: string) => Promise<Organization | null>
  clear: () => void
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      currentOrganization: null,
      organizations: [],
      loading: false,
      switchingOrganization: false,
      error: null,

      setCurrentOrganization: (org) => {
        set({ currentOrganization: org, switchingOrganization: true })
        setTimeout(() => set({ switchingOrganization: false }), 600)
      },

      fetchOrganizations: async () => {
        set({ loading: true, error: null })
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            set({ organizations: [], currentOrganization: null, loading: false })
            return
          }

          const { data: members, error: membersError } = await supabase
            .from('organization_members')
            .select(`
              id,
              role,
              organization_id,
              organizations(id, name, slug, logo_url, primary_color, secondary_color, accent_color, font_family, font_heading, border_radius, button_style, settings, subscription_tier, subscription_status)
            `)
            .eq('user_id', user.id)

          if (membersError) throw membersError

          const orgs: OrganizationWithMember[] = (members || [])
            .filter((m: { organizations: unknown }) => m.organizations != null)
            .map((m: { organizations: Organization; role: string }) => ({
              ...m.organizations,
              member: { role: m.role } as OrganizationMember,
            }))

          set({ organizations: orgs })

          const { currentOrganization } = get()
          if (orgs.length > 0 && !currentOrganization) {
            set({ currentOrganization: orgs[0] })
          } else if (orgs.length > 0 && currentOrganization) {
            const stillMember = orgs.some((o) => o.id === currentOrganization.id)
            if (!stillMember) {
              set({ currentOrganization: orgs[0] })
            }
          } else {
            set({ currentOrganization: null })
          }
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Error al cargar organizaciones',
            organizations: [],
            currentOrganization: null,
          })
        } finally {
          set({ loading: false })
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
            subscription_tier: 'starter',
            subscription_status: 'active',
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
