import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { trackAuditAction } from '@/lib/audit'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { X, ArrowRight } from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'

interface InventoryTransferModalProps {
  inventoryItem: {
    id: string
    branch_id: string
    branch_name: string
    product_id: string | null
    variant_id: string | null
    product_name: string
    variant_name?: string | null
    current_stock: number
  }
  branches: Branch[]
  onClose: () => void
  onSuccess: () => void
}

export function InventoryTransferModal({
  inventoryItem,
  branches,
  onClose,
  onSuccess,
}: InventoryTransferModalProps) {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const [toBranchId, setToBranchId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const isAutomaticTransferCompletion = settings.inventory_transfer_completion_mode === 'automatic'

  const sourceBranch = branches.find((b) => b.id === inventoryItem.branch_id)
  const availableBranches = branches.filter(
    (b) => b.id !== inventoryItem.branch_id && b.is_active && (b.can_receive ?? true)
  )

  const resolveTransferType = (fromKind?: string | null, toKind?: string | null): string => {
    if (fromKind === 'seller' && toKind === 'seller') return 'seller_handoff'
    if (fromKind === 'seller' && (toKind === 'warehouse' || toKind === 'store')) return 'seller_return'
    if ((fromKind === 'warehouse' || fromKind === 'store') && toKind === 'seller') return 'seller_withdrawal'
    return 'regular'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!toBranchId) {
      show('Selecciona una sucursal destino', 'error')
      return
    }

    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      show('La cantidad debe ser mayor a 0', 'error')
      return
    }

    if (qty > inventoryItem.current_stock) {
      show(`Stock insuficiente. Disponible: ${inventoryItem.current_stock}`, 'error')
      return
    }

    if (sourceBranch && sourceBranch.can_dispatch === false) {
      show('La sucursal origen no tiene permitido despachar inventario.', 'error')
      return
    }

    const destinationBranch = branches.find((b) => b.id === toBranchId)
    const transferType = resolveTransferType(sourceBranch?.kind, destinationBranch?.kind)
    const consignmentEnabled = Boolean(settings.consignment_enabled)

    if (!consignmentEnabled && transferType !== 'regular') {
      show('El módulo de consignación no está habilitado para esta organización.', 'error')
      return
    }

    setLoading(true)

    try {
      // Type assertion needed because PostgREST types may not be updated after migration 028
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('create_inventory_transfer', {
        p_from_branch_id: inventoryItem.branch_id,
        p_to_branch_id: toBranchId,
        p_quantity: qty,
        p_product_id: inventoryItem.product_id || null,
        p_variant_id: inventoryItem.variant_id || null,
        p_notes: notes || null,
        p_transfer_type: transferType,
      })

      if (error) throw error

      await trackAuditAction({
        organizationId,
        tableName: 'inventory_transfers',
        recordId: inventoryItem.id,
        action: 'INSERT',
        notes: 'Transferencia de inventario entre sucursales creada desde modal.',
        newData: {
          from_branch_id: inventoryItem.branch_id,
          to_branch_id: toBranchId,
          quantity: qty,
          product_id: inventoryItem.product_id,
          variant_id: inventoryItem.variant_id,
          transfer_type: transferType,
          notes: notes || null,
        },
      })

      const destinationName = branches.find((b) => b.id === toBranchId)?.name
      const successMessage = isAutomaticTransferCompletion
        ? `Transferencia completada: ${qty} unidades a ${destinationName}`
        : `Transferencia creada: ${qty} unidades a ${destinationName}`
      show(successMessage, 'success')
      onSuccess()
      onClose()
    } catch (error: unknown) {
      console.error('Error creating transfer:', error)
      const message = error instanceof Error ? error.message : 'Error al crear la transferencia'
      show(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 pt-4 sm:items-center sm:p-4">
      <Card className="flex w-full max-w-md max-h-[95vh] flex-col overflow-hidden sm:max-h-[90vh]">
        <CardHeader className="border-b pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-xl">
              <ArrowRight className="h-5 w-5 text-admin-600" />
              <span>Transferencia entre Sucursales</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-4 sm:pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 sm:p-4">
              <p className="text-sm text-gray-600 mb-1">Producto</p>
              <p className="font-medium text-gray-900">{inventoryItem.product_name}</p>
              {inventoryItem.variant_name && (
                <p className="text-sm text-gray-600">Variante: {inventoryItem.variant_name}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                Desde: <span className="font-medium">{inventoryItem.branch_name}</span>
              </p>
              <p className="text-sm font-medium text-gray-900 mt-2">
                Stock disponible: <span className="text-admin-600">{inventoryItem.current_stock}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sucursal Destino *
              </label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                required
              >
                <option value="">Selecciona una sucursal...</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.kind === 'warehouse' ? ' · Depósito' : branch.kind === 'seller' ? ' · Vendedor' : ''}
                    {branch.is_isolated_warehouse ? ' · Aislado' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad a transferir *
              </label>
              <Input
                type="number"
                min="1"
                max={inventoryItem.current_stock}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cantidad"
                required
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo disponible: {inventoryItem.current_stock}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
                rows={3}
                placeholder="Notas sobre la transferencia..."
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Nota:</strong>{' '}
                {isAutomaticTransferCompletion
                  ? 'El stock se descontará en origen y se acreditará automáticamente en destino.'
                  : 'El stock se descontará inmediatamente de la sucursal origen. La sucursal destino deberá confirmar la recepción para completar la transferencia.'}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:space-x-4 sm:gap-0 sm:pt-4">
              <Button type="submit" className="flex-1" disabled={loading || availableBranches.length === 0}>
                {loading ? 'Creando...' : 'Crear Transferencia'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
