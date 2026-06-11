import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'
import { queryKeys } from '@/lib/queryKeys'
import { useMemo, useCallback } from 'react'
import type { InventoryLot, InventoryLotInsert, InventoryLotUpdate } from '@/types/database.types'

export interface LotWithDetails extends InventoryLot {
  product_name: string | null
  product_sku: string | null
  variant_name: string | null
  branch_name: string | null
  supplier_name: string | null
  days_in_storage: number
  days_until_expiry: number | null
  urgency: 'critical' | 'warning' | 'ok' | 'none'
}

export interface LotsStats {
  critical: number
  warning: number
  stale: number
}

interface UseLotsOptions {
  branchId?: string
  staleThresholdDays?: number
}

function mapLot(row: any): LotWithDetails {
  const now = new Date()
  const receivedAt = new Date(row.received_at)
  const daysInStorage = Math.floor((now.getTime() - receivedAt.getTime()) / (1000 * 60 * 60 * 24))

  let daysUntilExpiry: number | null = null
  let urgency: LotWithDetails['urgency'] = 'none'

  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at)
    daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilExpiry <= 7) urgency = 'critical'
    else if (daysUntilExpiry <= 30) urgency = 'warning'
    else urgency = 'ok'
  }

  return {
    ...row,
    product_name: row.product?.name ?? null,
    product_sku: row.product?.sku ?? null,
    variant_name: row.variant?.name ?? null,
    branch_name: row.branch?.name ?? null,
    supplier_name: row.supplier?.name ?? null,
    days_in_storage: daysInStorage,
    days_until_expiry: daysUntilExpiry,
    urgency,
  }
}

export function useLots({ branchId, staleThresholdDays = 60 }: UseLotsOptions = {}) {
  const { organizationId } = useOrganization()
  const queryClient = useQueryClient()

  const { data: lots = [], isPending: loading, error: queryError } = useQuery({
    queryKey: queryKeys.inventory.lots(organizationId!),
    queryFn: async () => {
      let query = supabase
        .from('inventory_lots')
        .select(`
          *,
          product:products(name, sku),
          variant:product_variants(name),
          branch:branches(name),
          supplier:suppliers(name)
        `)
        .eq('organization_id', organizationId!)
        .eq('status', 'active')
        .order('expires_at', { ascending: true, nullsFirst: false })

      if (branchId) query = query.eq('branch_id', branchId)

      const { data, error: err } = await query
      if (err) throw err
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any) => mapLot(row))
    },
    enabled: !!organizationId,
    staleTime: 3 * 60 * 1000,
  })

  const error = queryError ? (queryError as Error).message : null

  const invalidateLots = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lots(organizationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(organizationId) })
    }
  }

  const createLotMutation = useMutation({
    mutationFn: async (payload: Omit<InventoryLotInsert, 'organization_id'>) => {
      if (!organizationId) throw new Error('Sin organización')
      const { error: err } = await supabase
        .from('inventory_lots')
        .insert({ ...payload, organization_id: organizationId })
      if (err) throw err
    },
    onSuccess: invalidateLots,
  })

  const updateLotMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: InventoryLotUpdate }) => {
      const { error: err } = await supabase
        .from('inventory_lots')
        .update(payload)
        .eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateLots,
  })

  const writeOffLotMutation = useMutation({
    mutationFn: async ({ id, reason, quantity }: { id: string; reason: string; quantity?: number }) => {
      const lot = lots.find((l) => l.id === id)
      if (!lot) throw new Error('Lote no encontrado')

      const remaining = quantity !== undefined ? lot.quantity_remaining - quantity : 0

      const { error: err } = await supabase
        .from('inventory_lots')
        .update({
          quantity_remaining: Math.max(0, remaining),
          status: remaining <= 0 ? 'written_off' : 'active',
          writeoff_reason: reason,
          writeoff_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (err) throw err
    },
    onSuccess: invalidateLots,
  })

  const stats: LotsStats = useMemo(() => ({
    critical: lots.filter((l) => l.urgency === 'critical').length,
    warning: lots.filter((l) => l.urgency === 'warning').length,
    stale: lots.filter((l) => l.urgency === 'none' && l.days_in_storage >= staleThresholdDays).length,
  }), [lots, staleThresholdDays])

  const hasExpiryData = useMemo(() => lots.some((l) => l.expires_at !== null), [lots])

  const createLot = useCallback(
    (payload: Omit<InventoryLotInsert, 'organization_id'>) => createLotMutation.mutateAsync(payload),
    [createLotMutation]
  )

  const updateLot = useCallback(
    (id: string, payload: InventoryLotUpdate) => updateLotMutation.mutateAsync({ id, payload }),
    [updateLotMutation]
  )

  const writeOffLot = useCallback(
    (id: string, reason: string, quantity?: number) => writeOffLotMutation.mutateAsync({ id, reason, quantity }),
    [writeOffLotMutation]
  )

  const getLotMovements = useCallback(async (lotId: string) => {
    const { data, error: err } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('lot_id', lotId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (err) throw err
    return data ?? []
  }, [])

  const fetchLots = () => invalidateLots()

  return {
    lots,
    loading,
    error,
    stats,
    hasExpiryData,
    fetchLots,
    createLot,
    updateLot,
    writeOffLot,
    getLotMovements,
  }
}
