import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useOrganization } from '@/hooks/useOrganization'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import {
  AlertTriangle,
  CheckSquare,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  Square,
  Truck,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface ReposicionItem {
  product_id: string
  product_name: string
  sku: string | null
  branch_id: string
  branch_name: string
  stock_actual: number
  low_stock_threshold: number
  min_stock: number
  ventas_30d: number
  dias_stock: number | null
  supplier_id: string | null
  supplier_name: string | null
}

interface Branch {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
}

const rowKey = (item: ReposicionItem) => `${item.product_id}-${item.branch_id}`

// ─── PO Modal ────────────────────────────────────────────────────────────────

interface POGroup {
  supplier_id: string | null
  supplier_name: string | null
  items: (ReposicionItem & { cantidad: number })[]
}

interface ReposicionPOModalProps {
  selectedItems: ReposicionItem[]
  organizationId: string
  branches: Branch[]
  onClose: () => void
  onCreated: () => void
}

function ReposicionPOModal({ selectedItems, organizationId, branches, onClose, onCreated }: ReposicionPOModalProps) {
  const { show } = useToastStore()
  const [saving, setSaving] = useState(false)
  const [destBranchId, setDestBranchId] = useState(branches[0]?.id ?? '')

  // Editable quantities per row key
  const [cantidades, setCantidades] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of selectedItems) {
      const sugerida = Math.max(item.low_stock_threshold * 2 - item.stock_actual, 1)
      init[rowKey(item)] = sugerida
    }
    return init
  })

  // Group by supplier
  const groups = useMemo((): POGroup[] => {
    const map = new Map<string | null, ReposicionItem[]>()
    for (const item of selectedItems) {
      const key = item.supplier_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    const result: POGroup[] = []
    for (const [sid, items] of map) {
      result.push({
        supplier_id: sid,
        supplier_name: items[0].supplier_name,
        items: items.map(i => ({ ...i, cantidad: cantidades[rowKey(i)] ?? 1 })),
      })
    }
    // Groups with supplier first, without supplier last
    result.sort((a, b) => {
      if (a.supplier_id && !b.supplier_id) return -1
      if (!a.supplier_id && b.supplier_id) return 1
      return (a.supplier_name ?? '').localeCompare(b.supplier_name ?? '')
    })
    return result
  }, [selectedItems, cantidades])

  const withSupplier = groups.filter(g => g.supplier_id !== null)
  const withoutSupplier = groups.find(g => g.supplier_id === null)

  async function handleCreate() {
    if (!destBranchId) {
      show('Seleccioná una sucursal de destino', 'error')
      return
    }
    if (withSupplier.length === 0) {
      show('Ninguno de los productos seleccionados tiene proveedor asignado', 'error')
      return
    }

    setSaving(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id ?? null

      let totalPOs = 0
      for (const group of withSupplier) {
        // 1. Crear purchase_order
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: po, error: poError } = await (supabase as any)
          .from('purchase_orders')
          .insert({
            organization_id: organizationId,
            supplier_id: group.supplier_id,
            branch_id: destBranchId,
            status: 'submitted',
            notes: 'Generada desde pantalla de reposición',
            created_by: userId,
          })
          .select('id')
          .single()

        if (poError) throw poError

        // 2. Crear purchase_order_items
        const itemsToInsert = group.items
          .filter(i => (cantidades[rowKey(i)] ?? 0) > 0)
          .map((item, idx) => ({
            organization_id: organizationId,
            purchase_order_id: po.id,
            product_id: item.product_id,
            variant_id: null,
            line_number: idx + 1,
            quantity_ordered: cantidades[rowKey(item)] ?? 1,
            quantity_received: 0,
            unit_cost: 0,
          }))

        if (itemsToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: itemsError } = await (supabase as any)
            .from('purchase_order_items')
            .insert(itemsToInsert)

          if (itemsError) throw itemsError
        }

        totalPOs++
      }

      show(
        `${totalPOs} orden${totalPOs > 1 ? 'es' : ''} de compra creada${totalPOs > 1 ? 's' : ''} correctamente`,
        'success'
      )
      onCreated()
    } catch (err) {
      console.error('Error creando POs:', err)
      show('Error al crear las órdenes de compra', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-admin-600" />
            <h2 className="text-base font-semibold text-gray-900">Crear órdenes de compra</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {/* Branch selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 shrink-0">Sucursal destino:</label>
            <select
              value={destBranchId}
              onChange={e => setDestBranchId(e.target.value)}
              className="h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Groups with supplier */}
          {withSupplier.map(group => (
            <div key={group.supplier_id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">{group.supplier_name}</span>
                <span className="text-xs text-gray-400">({group.items.length} producto{group.items.length > 1 ? 's' : ''})</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock actual</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-28">Cantidad a pedir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.items.map(item => (
                      <tr key={rowKey(item)}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                          {item.sku && <p className="text-xs text-gray-400 font-mono">{item.sku}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm font-semibold text-red-600">{item.stock_actual}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={cantidades[rowKey(item)] ?? 1}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1)
                              setCantidades(prev => ({ ...prev, [rowKey(item)]: val }))
                            }}
                            className="w-20 h-8 text-center border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Products without supplier */}
          {withoutSupplier && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {withoutSupplier.items.length} producto{withoutSupplier.items.length > 1 ? 's' : ''} sin proveedor asignado
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    {withoutSupplier.items.map(i => i.product_name).join(', ')} — no se incluirán en las órdenes.
                    Asignales un proveedor primario desde el catálogo de Productos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {withSupplier.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              Ninguno de los productos seleccionados tiene proveedor asignado.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <Button
            onClick={handleCreate}
            disabled={saving || withSupplier.length === 0}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-2" />
            )}
            {saving
              ? 'Creando...'
              : `Crear ${withSupplier.length} orden${withSupplier.length > 1 ? 'es' : ''} de compra`
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminReposicion() {
  const { organizationId } = useOrganization()
  const { show } = useToastStore()
  const [items, setItems] = useState<ReposicionItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showPOModal, setShowPOModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')

  const fetchData = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const [reposResult, branchesResult, suppliersResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc('get_reposicion_report', { p_organization_id: organizationId }),
        supabase
          .from('branches')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('suppliers')
          .select('id, name')
          .eq('organization_id', organizationId)
          .order('name'),
      ])

      if (reposResult.error) throw reposResult.error
      if (branchesResult.error) throw branchesResult.error
      if (suppliersResult.error) throw suppliersResult.error

      setItems((reposResult.data ?? []) as ReposicionItem[])
      setBranches((branchesResult.data ?? []) as Branch[])
      setSuppliers((suppliersResult.data ?? []) as Supplier[])
    } catch (err) {
      console.error('Error cargando reposición:', err)
      show('Error al cargar los productos a reponer', 'error')
    } finally {
      setLoading(false)
    }
  }, [organizationId, show])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const assignSupplier = useCallback(async (productId: string, supplierId: string) => {
    try {
      // Unset current primary supplier if any
      await supabase
        .from('product_suppliers')
        .update({ is_primary: false })
        .eq('product_id', productId)
        .eq('is_primary', true)

      // Upsert new primary supplier
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('product_suppliers')
        .upsert(
          { product_id: productId, supplier_id: supplierId, is_primary: true },
          { onConflict: 'product_id,supplier_id' }
        )

      if (error) throw error

      const supplierName = suppliers.find(s => s.id === supplierId)?.name ?? null
      setItems(prev =>
        prev.map(i =>
          i.product_id === productId
            ? { ...i, supplier_id: supplierId, supplier_name: supplierName }
            : i
        )
      )
      show('Proveedor asignado', 'success')
    } catch (err) {
      console.error('Error asignando proveedor:', err)
      show('Error al asignar el proveedor', 'error')
    }
  }, [suppliers, show])

  // Unique branches and suppliers for filter selects
  const uniqueBranches = useMemo(() =>
    [...new Map(items.map(i => [i.branch_id, { id: i.branch_id, name: i.branch_name }])).values()],
    [items]
  )
  const uniqueSuppliers = useMemo(() =>
    [...new Map(
      items
        .filter(i => i.supplier_id)
        .map(i => [i.supplier_id, { id: i.supplier_id!, name: i.supplier_name! }])
    ).values()],
    [items]
  )

  const filtered = useMemo(() => {
    let result = items
    if (search.trim()) {
      const term = search.trim().toLowerCase()
      result = result.filter(i =>
        i.product_name.toLowerCase().includes(term) ||
        (i.sku && i.sku.toLowerCase().includes(term))
      )
    }
    if (filterBranch) result = result.filter(i => i.branch_id === filterBranch)
    if (filterSupplier) result = result.filter(i => i.supplier_id === filterSupplier)
    return result
  }, [items, search, filterBranch, filterSupplier])

  const allKeys = useMemo(() => filtered.map(rowKey), [filtered])
  const allSelected = allKeys.length > 0 && allKeys.every(k => selected.has(k))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        allKeys.forEach(k => next.delete(k))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...allKeys]))
    }
  }

  function toggleItem(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const selectedItems = useMemo(
    () => items.filter(i => selected.has(rowKey(i))),
    [items, selected]
  )

  const hasFilters = search || filterBranch || filterSupplier

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Qué reponer hoy</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Productos bajo umbral de stock con su rotación y proveedor
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            placeholder="Nombre o SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Branch filter */}
        {uniqueBranches.length > 1 && (
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className={`h-9 border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${
              filterBranch ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <option value="">Todas las sucursales</option>
            {uniqueBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {/* Supplier filter */}
        {uniqueSuppliers.length > 0 && (
          <select
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
            className={`h-9 border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${
              filterSupplier ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <option value="">Todos los proveedores</option>
            {uniqueSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterBranch(''); setFilterSupplier('') }}
            className="h-9 px-3 rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 flex items-center gap-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={10} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={items.length === 0 ? 'Todo el stock está en orden' : 'Sin resultados'}
          description={
            items.length === 0
              ? 'No hay productos por debajo de su umbral de stock. Volvé más tarde.'
              : 'Probá cambiando los filtros.'
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-admin-600">
                      {allSelected
                        ? <CheckSquare className="h-4 w-4 text-admin-600" />
                        : <Square className="h-4 w-4" />
                      }
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sucursal</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Umbral</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Días de stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => {
                  const key = rowKey(item)
                  const isSelected = selected.has(key)
                  return (
                    <tr
                      key={key}
                      onClick={() => toggleItem(key)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-admin-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3">
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-admin-600" />
                          : <Square className="h-4 w-4 text-gray-300" />
                        }
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        {item.sku && <p className="text-xs text-gray-400 font-mono">{item.sku}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {item.branch_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-red-600">{item.stock_actual}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-500">{item.low_stock_threshold}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.dias_stock === null ? (
                          <span className="text-xs text-gray-400">Sin datos</span>
                        ) : (
                          <span className={`text-sm font-mono font-semibold ${
                            item.dias_stock < 7 ? 'text-red-600' : item.dias_stock < 14 ? 'text-yellow-600' : 'text-gray-700'
                          }`}>
                            {item.dias_stock}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {item.supplier_name ? (
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700">{item.supplier_name}</span>
                          </div>
                        ) : suppliers.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">Sin proveedor</span>
                        ) : (
                          <select
                            defaultValue=""
                            onChange={e => { if (e.target.value) assignSupplier(item.product_id, e.target.value) }}
                            className="h-8 border border-dashed border-gray-300 rounded-md px-2 text-xs text-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-admin-500 hover:border-gray-400"
                          >
                            <option value="" disabled>Asignar proveedor...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map(item => {
              const key = rowKey(item)
              const isSelected = selected.has(key)
              return (
                <div
                  key={key}
                  onClick={() => toggleItem(key)}
                  className={`p-4 flex items-start gap-3 cursor-pointer ${isSelected ? 'bg-admin-50' : ''}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isSelected
                      ? <CheckSquare className="h-5 w-5 text-admin-600" />
                      : <Square className="h-5 w-5 text-gray-300" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                        {item.sku && <p className="text-xs text-gray-400 font-mono">{item.sku}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-lg font-bold text-red-600">{item.stock_actual}</span>
                        <p className="text-xs text-gray-400">/ {item.low_stock_threshold} umbral</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.branch_name}</span>
                      {item.dias_stock !== null && (
                        <span className={`px-2 py-0.5 rounded font-mono font-semibold ${
                          item.dias_stock < 7 ? 'bg-red-100 text-red-700' : item.dias_stock < 14 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.dias_stock}d de stock
                        </span>
                      )}
                      {item.supplier_name ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{item.supplier_name}</span>
                      ) : suppliers.length > 0 ? (
                        <select
                          defaultValue=""
                          onClick={e => e.stopPropagation()}
                          onChange={e => { if (e.target.value) assignSupplier(item.product_id, e.target.value) }}
                          className="h-7 border border-dashed border-gray-300 rounded-md px-2 text-xs text-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
                        >
                          <option value="" disabled>Asignar proveedor...</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-gray-400 italic">Sin proveedor</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary row */}
          <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500">
              {filtered.length} producto{filtered.length !== 1 ? 's' : ''} bajo umbral
            </span>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Limpiar selección
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sticky footer — visible when items are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between z-40 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-admin-600" />
            <span className="text-gray-700">
              <strong className="text-gray-900">{selected.size}</strong> producto{selected.size > 1 ? 's' : ''} seleccionado{selected.size > 1 ? 's' : ''}
            </span>
          </div>
          <Button onClick={() => setShowPOModal(true)}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Crear orden de compra
          </Button>
        </div>
      )}

      {/* PO Modal */}
      {showPOModal && organizationId && (
        <ReposicionPOModal
          selectedItems={selectedItems}
          organizationId={organizationId}
          branches={branches}
          onClose={() => setShowPOModal(false)}
          onCreated={() => {
            setShowPOModal(false)
            setSelected(new Set())
            fetchData()
          }}
        />
      )}
    </div>
  )
}
