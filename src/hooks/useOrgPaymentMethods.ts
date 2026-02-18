import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import type { OrganizationPaymentMethod } from '@/types/database.types'

type UseOrgPaymentMethodsOptions = {
  /** Si true, incluye métodos inactivos (para admin al verificar keys existentes) */
  includeInactive?: boolean
}

/**
 * Obtiene los métodos de pago de la organización.
 * Por defecto solo activos (Checkout, ManualSaleForm).
 * Con includeInactive: true devuelve todos (admin para evitar duplicados).
 */
export function useOrgPaymentMethods(
  organizationId?: string | null,
  options?: UseOrgPaymentMethodsOptions
): {
  methods: OrganizationPaymentMethod[]
  loading: boolean
  refetch: () => Promise<void>
} {
  const { includeInactive = false } = options ?? {}
  const currentOrgId = useOrganizationStore((s) => s.currentOrganization?.id)
  const orgId = organizationId ?? currentOrgId
  const [methods, setMethods] = useState<OrganizationPaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    if (!orgId) {
      setMethods([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      let query = supabase
        .from('organization_payment_methods')
        .select('*')
        .eq('organization_id', orgId)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) throw error
      setMethods((data ?? []) as OrganizationPaymentMethod[])
    } catch (err) {
      console.error('Error fetching payment methods:', err)
      setMethods([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
  }, [orgId, includeInactive])

  return { methods, loading, refetch: fetch }
}
