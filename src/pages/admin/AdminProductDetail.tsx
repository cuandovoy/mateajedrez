import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Warehouse,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  TrendingUp,
  Building2,
  Star,
  AlertTriangle,
} from 'lucide-react'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useToastStore } from '@/store/toastStore'
import {
  useProductHeader,
  useProductStockByBranch,
  useProductMovements,
  useProductTransfers,
  useProductPurchaseItems,
  useProductSales,
  useProductSuppliers,
} from '@/hooks/useProductDetail'
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPrice, formatDateShort, hasActiveDiscount } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'

// ─── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'stock' | 'movimientos' | 'transferencias' | 'compras' | 'ventas' | 'proveedores'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'stock', label: 'Stock por Sucursal' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'transferencias', label: 'Transferencias' },
  { key: 'compras', label: 'Órdenes de Compra' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'proveedores', label: 'Proveedores' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function marginColor(margin: number | null): string {
  if (margin === null) return 'text-gray-400'
  if (margin >= 40) return 'text-green-600 font-semibold'
  if (margin >= 20) return 'text-yellow-600 font-semibold'
  return 'text-red-600 font-semibold'
}

function formatMargin(margin: number | null): string {
  if (margin === null) return '—'
  return `${margin.toFixed(1)}%`
}

const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  receipt: { label: 'Recepción', className: 'bg-green-100 text-green-800' },
  sale: { label: 'Venta', className: 'bg-blue-100 text-blue-800' },
  transfer_out: { label: 'Transferencia salida', className: 'bg-orange-100 text-orange-800' },
  transfer_in: { label: 'Transferencia entrada', className: 'bg-emerald-100 text-emerald-800' },
  adjustment: { label: 'Ajuste', className: 'bg-gray-100 text-gray-700' },
  return: { label: 'Devolución', className: 'bg-purple-100 text-purple-800' },
  manual: { label: 'Manual', className: 'bg-gray-100 text-gray-600' },
}

function movementTypeBadge(type: string) {
  const config = MOVEMENT_TYPE_CONFIG[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}

function transferStatusBadge(status: string) {
  const map: Record<string, string> = {
    pendiente: 'bg-gray-100 text-gray-700',
    completada: 'bg-green-100 text-green-800',
    cancelada: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-700',
  }
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    completada: 'Completada',
    cancelada: 'Cancelada',
    completed: 'Completada',
    cancelled: 'Cancelada',
    pending: 'Pendiente',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function poStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-800',
    partially_received: 'bg-amber-100 text-amber-800',
    received: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    draft: 'Borrador',
    submitted: 'Enviada',
    partially_received: 'Recepción parcial',
    received: 'Recibida',
    cancelled: 'Cancelada',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function orderStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending_allocation: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    pending_allocation: 'Pend. asignación',
    pending: 'Pendiente',
    processing: 'En proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return '—'
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminProductDetail() {
  const { id: productId } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()

  // Tab state — read from URL, default to 'stock'
  const activeTab = (searchParams.get('tab') as TabKey) ?? 'stock'

  // Pagination state per paginated tab
  const [movementsPage, setMovementsPage] = useState(0)
  const [movementsType, setMovementsType] = useState<string | undefined>(undefined)
  const [salesPage, setSalesPage] = useState(0)

  // Reset pagination when tab changes
  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab })
    if (tab === 'movimientos') setMovementsPage(0)
    if (tab === 'ventas') setSalesPage(0)
  }

  // Header — always mounted
  const { data: headerData, isPending: headerLoading, error: headerError } = useProductHeader(
    organizationId ?? null,
    productId ?? null
  )

  // Redirect if product not found
  useEffect(() => {
    if (!headerLoading && !headerError && headerData === undefined) {
      show('Producto no encontrado', 'error')
      navigate('/products')
    }
    if (headerError) {
      const e = headerError as { code?: string }
      if (e?.code === 'PGRST116') {
        show('Producto no encontrado', 'error')
        navigate('/products')
      }
    }
  }, [headerLoading, headerError, headerData, navigate, show])

  // Section hooks — each gated by tab
  const { data: stockData, isPending: stockLoading, error: stockError } = useProductStockByBranch(
    organizationId ?? null,
    productId ?? null,
    { enabled: activeTab === 'stock' }
  )

  const { data: movementsData, isPending: movementsLoading, error: movementsError } = useProductMovements(
    organizationId ?? null,
    productId ?? null,
    movementsPage,
    movementsType,
    { enabled: activeTab === 'movimientos' }
  )

  const { data: transfersData, isPending: transfersLoading, error: transfersError } = useProductTransfers(
    organizationId ?? null,
    productId ?? null,
    { enabled: activeTab === 'transferencias' }
  )

  const { data: purchaseData, isPending: purchaseLoading, error: purchaseError } = useProductPurchaseItems(
    organizationId ?? null,
    productId ?? null,
    { enabled: activeTab === 'compras' }
  )

  const { data: salesData, isPending: salesLoading, error: salesError } = useProductSales(
    organizationId ?? null,
    productId ?? null,
    salesPage,
    { enabled: activeTab === 'ventas' }
  )

  const { data: suppliersData, isPending: suppliersLoading, error: suppliersError } = useProductSuppliers(
    organizationId ?? null,
    productId ?? null,
    { enabled: activeTab === 'proveedores' }
  )

  // ─── Back navigation ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/products')
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="spacing-section max-w-7xl mx-auto">
      {/* Back button */}
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Productos
      </button>

      {/* ── Header Section (3.2) ──────────────────────────────────────────── */}
      {headerLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
      ) : headerError ? (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
          No se pudo cargar el producto.
        </div>
      ) : headerData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {/* Product identity row */}
          <div className="flex flex-wrap items-start gap-3 mb-5">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {headerData.product.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-gray-600">
                  {headerData.product.sku}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    headerData.product.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {headerData.product.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            {/* Price display */}
            <div className="text-right">
              <div className="text-sm text-gray-500">Precio de lista</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatPrice(headerData.product.price, settings)}
              </div>
              {hasActiveDiscount(headerData.product) && (
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <span className="text-sm text-gray-900 font-medium">
                    {formatPrice(headerData.effectivePrice, settings)}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                    −{headerData.product.discount_percentage}%
                    {headerData.product.discount_expires_at && (
                      <span className="ml-1 font-normal text-orange-700">
                        hasta {formatDateShort(headerData.product.discount_expires_at, settings)}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Stock total</div>
              <div className="text-2xl font-bold text-gray-900">{headerData.totalStock}</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Costo promedio ponderado</div>
              <div className="text-2xl font-bold text-gray-900">
                {headerData.weightedAvgCost !== null
                  ? formatPrice(headerData.weightedAvgCost, settings)
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Margen actual</div>
              <div className={`text-2xl font-bold ${marginColor(headerData.currentMargin)}`}>
                {formatMargin(headerData.currentMargin)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Tab Bar (3.3) ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-admin-600 text-admin-700 bg-admin-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Panels ────────────────────────────────────────────────────── */}

      {/* 3.4 Stock por Sucursal */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Stock por Sucursal</h2>
          </div>
          {stockLoading ? (
            <div className="p-6"><SkeletonTable rows={3} /></div>
          ) : stockError ? (
            <div className="px-6 py-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                No se pudo cargar el stock por sucursal.
              </div>
            </div>
          ) : !stockData || stockData.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="Sin inventario"
              description="Este producto aún no tiene inventario en ninguna sucursal."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock actual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo promedio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Último costo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Umbral mínimo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Margen %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(stockData as any[]).map((row) => {
                    const stock = row.stock ?? 0
                    const threshold = row.low_stock_threshold ?? null
                    const stockClass =
                      stock <= 0
                        ? 'text-red-600 font-bold'
                        : threshold !== null && stock <= threshold
                        ? 'text-orange-500 font-bold'
                        : 'text-gray-900'
                    const price = headerData?.product.price ?? 0
                    const cost = row.avg_unit_cost ?? 0
                    const branchMargin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{(row.branch as any)?.name ?? '—'}</td>
                        <td className={`px-4 py-3 text-sm text-right ${stockClass}`}>{stock}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{formatPrice(cost, settings)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {row.last_purchase_unit_cost != null
                            ? formatPrice(row.last_purchase_unit_cost, settings)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {threshold != null ? threshold : '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${marginColor(branchMargin)}`}>
                          {formatMargin(branchMargin)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3.5 Movimientos */}
      {activeTab === 'movimientos' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Movimientos</h2>
            {/* Movement type filter */}
            <select
              value={movementsType ?? ''}
              onChange={(e) => {
                setMovementsType(e.target.value || undefined)
                setMovementsPage(0)
              }}
              className="h-9 border border-gray-200 rounded-lg text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-admin-500"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {movementsLoading ? (
            <div className="p-6"><SkeletonTable rows={25} /></div>
          ) : movementsError ? (
            <div className="px-6 py-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                No se pudo cargar los movimientos.
              </div>
            </div>
          ) : movementsData?.degraded ? (
            <div className="px-6 py-4">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  La función de movimientos aún no está disponible. Aplicá la migración{' '}
                  <code className="font-mono text-xs">get_product_movements</code> en tu base de datos.
                </span>
              </div>
            </div>
          ) : !movementsData?.rows || movementsData.rows.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Sin movimientos"
              description="No hay movimientos registrados para este producto."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock anterior</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock resultante</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registrado por</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {movementsData.rows.map((row) => {
                      const qty = Number(row.quantity)
                      const qtyClass = qty >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                      const qtyText = qty >= 0 ? `+${qty}` : `${qty}`
                      const refText =
                        row.reference_type && row.reference_id
                          ? `${row.reference_type} ${row.reference_id.slice(0, 8)}…`
                          : '—'
                      const date = new Date(row.created_at)
                      const timeStr = date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })
                      return (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {formatDateShort(row.created_at, settings)} {timeStr}
                          </td>
                          <td className="px-4 py-3">{movementTypeBadge(row.movement_type)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.branch_name}</td>
                          <td className={`px-4 py-3 text-sm text-right ${qtyClass}`}>{qtyText}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">{row.previous_stock}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{row.new_stock}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{refText}</td>
                          <td className="px-4 py-3 text-xs text-gray-500" title={row.notes ?? ''}>
                            {truncate(row.notes)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">Sistema</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500">
                  {movementsData.totalCount > 0 ? (
                    <>
                      Mostrando {movementsPage * PAGE_SIZE_ADMIN + 1}–
                      {Math.min((movementsPage + 1) * PAGE_SIZE_ADMIN, movementsData.totalCount)} de{' '}
                      {movementsData.totalCount} movimientos
                    </>
                  ) : (
                    'Sin resultados'
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementsPage((p) => Math.max(0, p - 1))}
                    disabled={movementsPage === 0}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementsPage((p) => p + 1)}
                    disabled={(movementsPage + 1) * PAGE_SIZE_ADMIN >= movementsData.totalCount}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3.6 Transferencias */}
      {activeTab === 'transferencias' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Transferencias</h2>
          </div>
          {transfersLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : transfersError ? (
            <div className="px-6 py-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                No se pudo cargar las transferencias.
              </div>
            </div>
          ) : !transfersData || (transfersData as any[]).length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Sin transferencias"
              description="No hay transferencias registradas para este producto."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(transfersData as any[]).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDateShort(row.created_at, settings)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.transfer_type ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.from_branch?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.to_branch?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{row.quantity}</td>
                      <td className="px-4 py-3">{transferStatusBadge(row.status ?? 'pending')}</td>
                      <td className="px-4 py-3 text-xs text-gray-500" title={row.notes ?? ''}>
                        {truncate(row.notes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3.7 Órdenes de Compra */}
      {activeTab === 'compras' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Órdenes de Compra</h2>
          </div>
          {purchaseLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : purchaseError ? (
            <div className="px-6 py-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                No se pudo cargar las órdenes de compra.
              </div>
            </div>
          ) : !purchaseData || (purchaseData as any[]).length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Sin órdenes de compra"
              description="No hay órdenes de compra para este producto."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo unitario</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado OC</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(purchaseData as any[]).map((row) => {
                    const po = row.purchase_order
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {po?.created_at ? formatDateShort(po.created_at, settings) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {po?.order_number ?? po?.id?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {po?.supplier?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {row.quantity_ordered ?? row.quantity ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {row.unit_cost != null ? formatPrice(Number(row.unit_cost), settings) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {row.total_cost != null
                            ? formatPrice(Number(row.total_cost), settings)
                            : row.unit_cost != null && (row.quantity_ordered ?? row.quantity) != null
                            ? formatPrice(Number(row.unit_cost) * Number(row.quantity_ordered ?? row.quantity), settings)
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {po?.status ? poStatusBadge(po.status) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3.8 Ventas */}
      {activeTab === 'ventas' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Ventas</h2>
          </div>
          {salesLoading ? (
            <div className="p-6"><SkeletonTable rows={25} /></div>
          ) : salesError ? (
            <div className="px-6 py-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                No se pudo cargar las ventas.
              </div>
            </div>
          ) : !salesData?.rows || salesData.rows.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Sin ventas"
              description="No hay ventas registradas para este producto."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Devueltos</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio venta</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Descuento</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Costo al momento</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Margen %</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado orden</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {(salesData.rows as any[]).map((row) => {
                      const order = row.order
                      const hasReturns = (row.returned_quantity ?? 0) > 0
                      const margin: number | null = row.margin_percentage_at_sale ?? null
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-gray-50 ${hasReturns ? 'bg-yellow-50' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {order?.created_at ? formatDateShort(order.created_at, settings) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {order?.order_number ?? order?.id?.slice(0, 8) ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {order?.branch?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{row.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {hasReturns ? (
                              <span className="text-red-600 font-medium">{row.returned_quantity}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {row.price != null ? formatPrice(Number(row.price), settings) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {row.discount_amount && Number(row.discount_amount) > 0
                              ? formatPrice(Number(row.discount_amount), settings)
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {row.cost_at_sale != null ? formatPrice(Number(row.cost_at_sale), settings) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right ${marginColor(margin)}`}>
                            {formatMargin(margin)}
                          </td>
                          <td className="px-4 py-3">
                            {order?.status ? orderStatusBadge(order.status) : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Sales pagination */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500">
                  {salesData.totalCount > 0 ? (
                    <>
                      Mostrando {salesPage * PAGE_SIZE_ADMIN + 1}–
                      {Math.min((salesPage + 1) * PAGE_SIZE_ADMIN, salesData.totalCount)} de{' '}
                      {salesData.totalCount} ventas
                    </>
                  ) : (
                    'Sin resultados'
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSalesPage((p) => Math.max(0, p - 1))}
                    disabled={salesPage === 0}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesPage((p) => p + 1)}
                    disabled={(salesPage + 1) * PAGE_SIZE_ADMIN >= salesData.totalCount}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3.9 Proveedores */}
      {activeTab === 'proveedores' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Proveedores</h2>
          </div>
          {suppliersLoading ? (
            <div className="p-6"><SkeletonTable rows={3} /></div>
          ) : suppliersError ? (
            <div className="px-6 py-4">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                No se pudo cargar los proveedores.
              </div>
            </div>
          ) : !suppliersData || (suppliersData as any[]).length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Sin proveedores"
              description="No hay proveedores asociados a este producto."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Lead time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cant. mínima</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(suppliersData as any[]).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex items-center gap-1.5">
                          {row.is_primary && (
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                          {row.supplier?.name ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">
                        {row.supplier_sku ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {row.supplier_price != null ? formatPrice(Number(row.supplier_price), settings) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {row.lead_time_days != null ? `${row.lead_time_days} días` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {row.min_order_quantity != null ? row.min_order_quantity : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500" title={row.notes ?? ''}>
                        {truncate(row.notes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
