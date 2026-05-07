import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'
import type { InventoryLot, InventoryLotInsert, InventoryLotUpdate } from '@/types/database.types'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  critical: number   // vencen en ≤7 días
  warning: number    // vencen en 8–30 días
  stale: number      // parados más del umbral
}

interface UseLotsOptions {
  branchId?: string
  staleThresholdDays?: number
}

export function useLots({ branchId, staleThresholdDays = 60 }: UseLotsOptions = {}) {
  const { organizationId } = useOrganization()
  const [lots, setLots] = useState<LotWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLots = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('inventory_lots')
        .select(`
          *,
          product:products(name, sku),
          variant:product_variants(name),
          branch:branches(name),
          supplier:suppliers(name)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('expires_at', { ascending: true, nullsFirst: false })

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error: err } = await query
      if (err) throw err

      const now = new Date()
      const mapped: LotWithDetails[] = (data ?? []).map((row: any) => {
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
      })

      setLots(mapped)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [organizationId, branchId])

  useEffect(() => {
    fetchLots()
  }, [fetchLots])

  const stats: LotsStats = useMemo(() => ({
    critical: lots.filter((l) => l.urgency === 'critical').length,
    warning: lots.filter((l) => l.urgency === 'warning').length,
    stale: lots.filter((l) => l.urgency === 'none' && l.days_in_storage >= staleThresholdDays).length,
  }), [lots, staleThresholdDays])

  // ¿La org ya tiene al menos un lote con vencimiento? → activa la columna
  const hasExpiryData = useMemo(() => lots.some((l) => l.expires_at !== null), [lots])

  const createLot = useCallback(async (payload: Omit<InventoryLotInsert, 'organization_id'>) => {
    if (!organizationId) throw new Error('Sin organización')
    const { error: err } = await supabase
      .from('inventory_lots')
      .insert({ ...payload, organization_id: organizationId })
    if (err) throw err
    await fetchLots()
  }, [organizationId, fetchLots])

  const updateLot = useCallback(async (id: string, payload: InventoryLotUpdate) => {
    const { error: err } = await supabase
      .from('inventory_lots')
      .update(payload)
      .eq('id', id)
    if (err) throw err
    await fetchLots()
  }, [fetchLots])

  const writeOffLot = useCallback(async (id: string, reason: string, quantity?: number) => {
    const lot = lots.find((l) => l.id === id)
    if (!lot) throw new Error('Lote no encontrado')

    const remaining = quantity !== undefined
      ? lot.quantity_remaining - quantity
      : 0

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
    await fetchLots()
  }, [lots, fetchLots])

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
