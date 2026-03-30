// src/hooks/useBillerConfig.ts
// Hook para leer la configuración de Biller de una organización.
// Patrón del proyecto: useState + useEffect + Supabase directo.

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { BillerConfig } from '@/types/biller'

export function useBillerConfig(organizationId: string | null) {
  const [config, setConfig] = useState<BillerConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchConfig = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    const { data } = await supabase
      .from('biller_config' as never)
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()
    setConfig(data ? (data as unknown as BillerConfig) : null)
    setLoading(false)
  }, [organizationId])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  return { config, loading, refetch: fetchConfig }
}
