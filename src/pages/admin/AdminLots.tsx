import { LotDetailPanel } from '@/components/admin/LotDetailPanel'
import { LotReceptionModal } from '@/components/admin/LotReceptionModal'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePermission } from '@/hooks/usePermission'
import { useLots, type LotWithDetails } from '@/hooks/useLots'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AlertTriangle, Package, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface Branch { id: string; name: string }
type FilterType = 'all' | 'critical' | 'warning' | 'stale'

const STALE_DAYS = 60

export function AdminLots() {
  const settings = useOrgSettings()

  if (settings.costing_method !== 'fifo') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 space-y-3">
        <Package className="h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-700">Trazabilidad por lotes no activada</h2>
        <p className="text-sm text-gray-500 max-w-md">
          La gestión de lotes está disponible cuando el método de costeo de la organización es <strong>FIFO</strong>.
          Con FIFO, cada recepción de mercadería genera un lote automáticamente y las ventas los consumen en orden de ingreso.
        </p>
        <p className="text-xs text-gray-400">
          Podés cambiar el método de costeo en Configuración → Organización.
        </p>
      </div>
    )
  }

  return <AdminLotsContent />
}

function AdminLotsContent() {
  const { organizationId } = useOrganization()
  const { can: canPerm, loading: permLoading } = usePermission()
  const canManage = canPerm('inventario:gestionar')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedLot, setSelectedLot] = useState<LotWithDetails | null>(null)
  const [showReception, setShowReception] = useState(false)

  const { lots, loading, stats, hasExpiryData, fetchLots, writeOffLot, getLotMovements } =
    useLots({ branchId: selectedBranchId || undefined, staleThresholdDays: STALE_DAYS })

  // Cargar sucursales
  useEffect(() => {
    if (!organizationId) return
    supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setBranches(data ?? [])
      })
  }, [organizationId])

  const filteredLots = useMemo(() => {
    let result = lots

    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(l =>
        l.product_name?.toLowerCase().includes(term) ||
        l.product_sku?.toLowerCase().includes(term)
      )
    }

    if (filter === 'critical') result = result.filter(l => l.urgency === 'critical')
    else if (filter === 'warning') result = result.filter(l => l.urgency === 'warning')
    else if (filter === 'stale') result = result.filter(l => l.urgency === 'none' && l.days_in_storage >= STALE_DAYS)

    return result
  }, [lots, search, filter])

  const handleWriteOff = useCallback(async (id: string, reason: string, quantity: number) => {
    await writeOffLot(id, reason, quantity)
    if (selectedLot?.id === id) setSelectedLot(null)
  }, [writeOffLot, selectedLot])

  const urgencyRow = (lot: LotWithDetails) => {
    if (lot.urgency === 'critical') return 'bg-red-50 hover:bg-red-100'
    if (lot.urgency === 'warning') return 'bg-amber-50 hover:bg-amber-100'
    if (lot.urgency === 'ok') return 'bg-green-50 hover:bg-green-100'
    if (lot.days_in_storage >= STALE_DAYS) return 'bg-gray-50 hover:bg-gray-100'
    return 'hover:bg-gray-50'
  }

  const urgencyDot = (lot: LotWithDetails) => {
    if (lot.urgency === 'critical') return '🔴'
    if (lot.urgency === 'warning') return '🟡'
    if (lot.urgency === 'ok') return '🟢'
    return '⬜'
  }

  if (permLoading) return null
  if (!canPerm('inventario:ver')) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lotes de inventario</h1>
          {!loading && (
            <div className="flex flex-wrap gap-3 mt-1 text-sm">
              {stats.critical > 0 && (
                <span className="text-red-600 font-medium">
                  🔴 {stats.critical} vencen esta semana
                </span>
              )}
              {stats.warning > 0 && (
                <span className="text-amber-600 font-medium">
                  🟡 {stats.warning} vencen este mes
                </span>
              )}
              {stats.stale > 0 && (
                <span className="text-gray-500 font-medium">
                  ⏱️ {stats.stale} parados +{STALE_DAYS} días
                </span>
              )}
              {stats.critical === 0 && stats.warning === 0 && stats.stale === 0 && lots.length > 0 && (
                <span className="text-green-600 font-medium">✅ Todo en orden</span>
              )}
            </div>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setShowReception(true)}
            className="flex items-center gap-2 px-4 py-2 bg-admin-600 hover:bg-admin-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Recibí mercadería
          </button>
        )}
      </div>

      <div className={cn('flex gap-4', selectedLot ? 'lg:gap-5' : '')}>
        {/* Tabla */}
        <div className={cn('flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden', selectedLot ? 'hidden lg:block' : '')}>
          {/* Filtros */}
          <div className="p-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="">Todas las sucursales</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 flex-1 min-w-[160px]"
            />
            <div className="flex gap-1">
              {(['all', 'critical', 'warning', 'stale'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filter === f
                      ? 'bg-admin-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {f === 'all' && 'Todos'}
                  {f === 'critical' && '🔴'}
                  {f === 'warning' && '🟡'}
                  {f === 'stale' && '⏱️'}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {lots.length === 0 ? 'No hay lotes registrados' : 'Sin resultados para esta búsqueda'}
              </p>
              {lots.length === 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  Hacé click en "Recibí mercadería" para registrar tu primer lote
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Producto</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Stock</th>
                    {hasExpiryData && (
                      <>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Vence</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Días rest.</th>
                      </>
                    )}
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">En depósito</th>
                    {branches.length > 1 && (
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Sucursal</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLots.map(lot => (
                    <tr
                      key={lot.id}
                      onClick={() => setSelectedLot(prev => prev?.id === lot.id ? null : lot)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        urgencyRow(lot),
                        selectedLot?.id === lot.id && 'ring-2 ring-inset ring-admin-400'
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="mr-1.5">{urgencyDot(lot)}</span>
                        <span className="font-medium text-gray-800">{lot.product_name}</span>
                        {lot.variant_name && (
                          <span className="text-gray-400 text-xs ml-1">· {lot.variant_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {lot.quantity_remaining}
                      </td>
                      {hasExpiryData && (
                        <>
                          <td className="px-4 py-3 text-gray-600">
                            {lot.expires_at
                              ? new Date(lot.expires_at).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' })
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={cn('px-4 py-3 text-right font-medium',
                            lot.urgency === 'critical' ? 'text-red-600' :
                            lot.urgency === 'warning' ? 'text-amber-600' :
                            lot.urgency === 'ok' ? 'text-green-600' : 'text-gray-300'
                          )}>
                            {lot.days_until_expiry !== null
                              ? `${lot.days_until_expiry}d`
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </>
                      )}
                      <td className={cn('px-4 py-3 text-right',
                        lot.days_in_storage >= STALE_DAYS ? 'text-amber-600 font-medium' : 'text-gray-500'
                      )}>
                        {lot.days_in_storage}d
                        {lot.days_in_storage >= STALE_DAYS && (
                          <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-400" />
                        )}
                      </td>
                      {branches.length > 1 && (
                        <td className="px-4 py-3 text-gray-500 text-xs">{lot.branch_name}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredLots.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              {filteredLots.length} lote{filteredLots.length !== 1 ? 's' : ''}
              {filter !== 'all' && ` · filtrando por ${filter}`}
            </div>
          )}
        </div>

        {/* Panel lateral */}
        {selectedLot && (
          <div className="w-full lg:w-80 xl:w-96 bg-white rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
            <LotDetailPanel
              lot={selectedLot}
              onWriteOff={canManage ? handleWriteOff : undefined}
              onLoadMovements={getLotMovements}
              onClose={() => setSelectedLot(null)}
            />
          </div>
        )}
      </div>

      {/* Mobile: panel ocupa toda la pantalla */}
      {selectedLot && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white">
          <LotDetailPanel
            lot={selectedLot}
            onWriteOff={handleWriteOff}
            onLoadMovements={getLotMovements}
            onClose={() => setSelectedLot(null)}
          />
        </div>
      )}

      {showReception && (
        <LotReceptionModal
          branches={branches}
          defaultBranchId={selectedBranchId || branches[0]?.id}
          onCreated={fetchLots}
          onClose={() => setShowReception(false)}
        />
      )}
    </div>
  )
}
