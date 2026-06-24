import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useOrganization } from '@/hooks/useOrganization'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ArrowRight, Package, CheckCircle, Clock, Search, XCircle } from 'lucide-react'
import { PlanGate } from '@/components/features/PlanGate'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { formatDateShort } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { InventoryTransfer } from '@/types'

interface TransferWithDetails extends InventoryTransfer {
  from_branch_name: string
  to_branch_name: string
  product_name: string | null
  variant_name: string | null
}

const getTransferTypeLabel = (type: string | null) => {
  switch (type) {
    case 'seller_withdrawal':
      return 'Retiro vendedora'
    case 'seller_return':
      return 'Rendición a depósito'
    case 'seller_handoff':
      return 'Pase entre vendedoras'
    default:
      return 'Transferencia regular'
  }
}

export function AdminTransfers() {
  const { show } = useToastStore()
  const settings = useOrgSettings()
  const { organizationId } = useOrganization()
  const { can, loading: permLoading } = usePermission()
  const { canUseFeature } = usePlanLimits()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: transfers = [], isPending: loading } = useQuery({
    queryKey: queryKeys.inventory.transfers(organizationId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transfers')
        .select(`
          *,
          from_branch:branches!inventory_transfers_from_branch_id_fkey(name),
          to_branch:branches!inventory_transfers_to_branch_id_fkey(name),
          product:products(id, name),
          variant:product_variants(id, name)
        `)
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((t: any) => ({
        ...t,
        from_branch_name: t.from_branch?.name || 'N/A',
        to_branch_name: t.to_branch?.name || 'N/A',
        product_name: t.product?.name || null,
        variant_name: t.variant?.name || null,
      })) as TransferWithDetails[]
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  })

  const invalidateTransfers = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transfers(organizationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all(organizationId) })
    }
  }

  const completeTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('complete_inventory_transfer', { p_transfer_id: transferId })
      if (error) throw error
    },
    onSuccess: () => { show('Transferencia completada exitosamente', 'success'); invalidateTransfers() },
    onError: (err: unknown) => show(err instanceof Error ? err.message : 'Error al completar la transferencia', 'error'),
  })

  const cancelTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('cancel_inventory_transfer', { p_transfer_id: transferId })
      if (error) throw error
    },
    onSuccess: () => { show('Transferencia cancelada. Stock restituido a la sucursal origen.', 'success'); invalidateTransfers() },
    onError: (err: unknown) => show(err instanceof Error ? err.message : 'Error al cancelar la transferencia', 'error'),
  })

  const handleCompleteTransfer = (transferId: string) => {
    if (!confirm('¿Confirmar recepción de esta transferencia? El stock se agregará a la sucursal destino.')) return
    completeTransfer.mutate(transferId)
  }

  const handleCancelTransfer = (transferId: string) => {
    if (!confirm('¿Cancelar esta transferencia? El stock será devuelto a la sucursal origen.')) return
    cancelTransfer.mutate(transferId)
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'in_transit':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'Completada'
      case 'cancelled':
        return 'Cancelada'
      case 'in_transit':
        return 'En Tránsito'
      default:
        return 'Pendiente'
    }
  }

  const filteredTransfers = useMemo(() => {
    let filtered = transfers

    if (statusFilter) {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.product_name?.toLowerCase().includes(searchLower) ||
          t.variant_name?.toLowerCase().includes(searchLower) ||
          t.from_branch_name.toLowerCase().includes(searchLower) ||
          t.to_branch_name.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [transfers, statusFilter, searchTerm])

  const pendingTransfers = filteredTransfers.filter((t) => t.status === 'pending').length
  const canManage = can('inventario:gestionar')

  if (permLoading) return <SkeletonTable rows={5} />
  if (!can('inventario:ver')) return null

  return (
    <PlanGate feature="transfers" canUse={canUseFeature('transfers')}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferencias de Inventario</h1>
          <p className="text-gray-600 mt-1">Gestiona las transferencias de stock entre sucursales</p>
        </div>
        {pendingTransfers > 0 && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              {pendingTransfers} transferencia{pendingTransfers !== 1 ? 's' : ''} pendiente{pendingTransfers !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por producto, variante o sucursal..."
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="in_transit">En Tránsito</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowRight className="h-5 w-5" />
            <span>Transferencias ({filteredTransfers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable rows={5} />
          ) : filteredTransfers.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No se encontraron transferencias"
              description={searchTerm || statusFilter ? 'Probá ajustar los filtros.' : 'Aún no hay transferencias registradas.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Desde</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Hacia</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {transfer.product_name || transfer.variant_name || 'N/A'}
                          </p>
                          {transfer.variant_name && transfer.product_name && (
                            <p className="text-xs text-gray-500">Variante: {transfer.variant_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">{transfer.from_branch_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">{transfer.to_branch_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{getTransferTypeLabel(transfer.transfer_type)}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-gray-900">{transfer.quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            transfer.status
                          )}`}
                        >
                          {getStatusLabel(transfer.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">
                          {formatDateShort(transfer.created_at, settings)}
                        </p>
                        {transfer.completed_at && (
                          <p className="text-xs text-gray-400">
                            Completada: {formatDateShort(transfer.completed_at, settings)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {transfer.status === 'pending' && canManage && (
                          <ActionsMenu
                            actions={[
                              {
                                label: 'Completar Transferencia',
                                icon: <CheckCircle className="h-4 w-4" />,
                                onClick: () => handleCompleteTransfer(transfer.id),
                              },
                              {
                                label: 'Cancelar Transferencia',
                                icon: <XCircle className="h-4 w-4" />,
                                onClick: () => handleCancelTransfer(transfer.id),
                                variant: 'danger' as const,
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PlanGate>
  )
}
