import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Organization } from '@/types/database.types'

/**
 * Store simplificado: la tienda pública es single-tenant por deploy (la
 * organización se resuelve una sola vez desde VITE_STORE_SLUG). Ya no existe
 * selector de organización ni RBAC de panel admin — solo se mantiene lo
 * necesario para resolver y exponer la organización activa de la tienda.
 */
interface OrganizationState {
  currentOrganization: Organization | null
  setCurrentOrganization: (org: Organization | null) => void
  fetchOrgBySlug: (slug: string) => Promise<Organization | null>
}

export const useOrganizationStore = create<OrganizationState>((set) => ({
  currentOrganization: null,

  setCurrentOrganization: (org) => set({ currentOrganization: org }),

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
}))
