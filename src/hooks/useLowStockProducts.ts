import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'

export interface LowStockProduct {
  name: string
}

export function useLowStockProducts(limit = 5) {
  const { organizationId } = useOrganization()
  const [data, setData] = useState<LowStockProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return

    let cancelled = false

    const fetch = async () => {
      try {
        const { data: rows } = await supabase
          .from('products')
          .select('name')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .or('stock.lte(min_stock),stock.lte(low_stock_threshold)')
          .order('stock', { ascending: true })
          .limit(limit)

        if (!cancelled) setData((rows as LowStockProduct[]) ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [organizationId, limit])

  return { data, loading }
}
