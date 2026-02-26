import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useOrganization } from '@/hooks/useOrganization'
import { formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Filter,
  RefreshCw,
  User
} from 'lucide-react'
import { useEffect, useState } from 'react'

type AuditLog = {
  id: string
  table_name: string
  record_id: string | null
  action: string
  user_id: string | null
  user_email: string | null
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  changed_fields: string[] | null
  notes: string | null
  created_at: string
}

const TABLE_NAMES = [
  'organizations',
  'organization_members',
  'organization_payment_methods',
  'branches',
  'user_profiles',
  'products',
  'categories',
  'product_variants',
  'product_images',
  'product_barcodes',
  'product_suppliers',
  'suppliers',
  'branch_inventory',
  'inventory_movements',
  'inventory_transfers',
  'purchase_orders',
  'purchase_order_items',
  'goods_receipts',
  'goods_receipt_items',
  'supplier_invoices',
  'supplier_payments',
  'expense_ledger',
  'order_returns',
  'order_return_items',
  'orders',
  'order_items',
  'order_payments',
  'cash_sessions',
  'audit_logs',
] as const

const ACTIONS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'ORDER_DISCOUNT_APPLIED',
  'ORDER_DISCOUNT_REMOVED',
  'ORDER_ITEM_DISCOUNT_APPLIED',
  'ORDER_ITEM_DISCOUNT_REMOVED',
  'ORDER_COLLECTION_REGISTERED',
  'ORDER_PAYMENT_DELETED',
] as const

export function AdminAuditLogs() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    user_id: '',
    record_id: '',
    start_date: '',
    end_date: '',
  })
  const pageSize = 50

  useEffect(() => {
    fetchLogs()
  }, [page, filters])

  const fetchLogs = async () => {
    try {
      setLoading(true)

      const params: any = {
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
        p_organization_id: organizationId || null,
      }

      if (filters.table_name) params.p_table_name = filters.table_name
      if (filters.action) params.p_action = filters.action
      if (filters.user_id) params.p_user_id = filters.user_id
      if (
        filters.record_id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.record_id)
      ) {
        params.p_record_id = filters.record_id
      }
      if (filters.start_date) params.p_start_date = filters.start_date
      if (filters.end_date) params.p_end_date = filters.end_date

      // Type assertion needed because PostgREST types may not be updated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_audit_logs', params)

      if (error) throw error

      setLogs((data || []) as AuditLog[])

      // Get total count (simplified - in production, you'd want a separate count function)
      if (data && data.length < pageSize) {
        setTotalCount((page - 1) * pageSize + data.length)
      } else {
        setTotalCount(page * pageSize + 1) // Estimate
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({
      table_name: '',
      action: '',
      user_id: '',
      record_id: '',
      start_date: '',
      end_date: '',
    })
    setPage(1)
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      case 'ORDER_DISCOUNT_APPLIED':
      case 'ORDER_ITEM_DISCOUNT_APPLIED':
        return 'bg-orange-100 text-orange-800'
      case 'ORDER_DISCOUNT_REMOVED':
      case 'ORDER_ITEM_DISCOUNT_REMOVED':
        return 'bg-amber-100 text-amber-800'
      case 'ORDER_COLLECTION_REGISTERED':
        return 'bg-green-100 text-green-800'
      case 'ORDER_PAYMENT_DELETED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      INSERT: 'Alta',
      UPDATE: 'Actualización',
      DELETE: 'Eliminación',
      SYNC: 'Sincronización',
      ORDER_DISCOUNT_APPLIED: 'Descuento aplicado (orden)',
      ORDER_DISCOUNT_REMOVED: 'Descuento removido (orden)',
      ORDER_ITEM_DISCOUNT_APPLIED: 'Descuento aplicado (ítem)',
      ORDER_ITEM_DISCOUNT_REMOVED: 'Descuento removido (ítem)',
      ORDER_COLLECTION_REGISTERED: 'Cobro registrado',
      ORDER_PAYMENT_DELETED: 'Cobro eliminado',
    }
    return labels[action] || `Acción técnica: ${action}`
  }

  const getChangeSummary = (log: AuditLog): string => {
    if (log.action === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0) {
      const fields = log.changed_fields.slice(0, 3).join(', ')
      const extra =
        log.changed_fields.length > 3 ? ` (+${log.changed_fields.length - 3} más)` : ''
      return `Se actualizaron: ${fields}${extra}`
    }

    if (log.action === 'INSERT') return 'Se dio de alta un nuevo registro'
    if (log.action === 'DELETE') return 'Se eliminó el registro'
    if (log.action === 'SYNC') return 'Se ejecutó una sincronización'
    if (log.action === 'ORDER_DISCOUNT_APPLIED') return 'Se aplicó un descuento a la orden'
    if (log.action === 'ORDER_DISCOUNT_REMOVED') return 'Se removió el descuento de la orden'
    if (log.action === 'ORDER_ITEM_DISCOUNT_APPLIED') return 'Se aplicó un descuento a un ítem'
    if (log.action === 'ORDER_ITEM_DISCOUNT_REMOVED') return 'Se removió el descuento de un ítem'
    if (log.action === 'ORDER_COLLECTION_REGISTERED') return 'Se registró un cobro de orden'
    if (log.action === 'ORDER_PAYMENT_DELETED') return 'Se eliminó un cobro de orden'

    return 'No hay detalle adicional disponible'
  }

  const getTableDisplayName = (tableName: string) => {
    const names: Record<string, string> = {
      organizations: 'Organizaciones: configuración general de la empresa',
      organization_members: 'Miembros de organización: altas, bajas y roles',
      organization_payment_methods: 'Métodos de pago de la organización',
      branches: 'Sucursales: datos de locales y puntos de venta',
      user_profiles: 'Perfiles de usuario del sistema',
      products: 'Productos del catálogo',
      categories: 'Categorías de productos',
      product_variants: 'Variantes de producto',
      product_images: 'Imágenes de productos',
      product_barcodes: 'Códigos de barras de productos',
      product_suppliers: 'Relación producto-proveedor',
      suppliers: 'Proveedores',
      branch_inventory: 'Inventario por sucursal',
      inventory_movements: 'Movimientos de inventario (entradas, salidas, ajustes)',
      inventory_transfers: 'Transferencias de inventario entre sucursales',
      purchase_orders: 'Órdenes de compra',
      purchase_order_items: 'Ítems de órdenes de compra',
      goods_receipts: 'Recepciones de mercadería',
      goods_receipt_items: 'Ítems de recepciones de mercadería',
      supplier_invoices: 'Facturas de proveedor',
      supplier_payments: 'Pagos a proveedores',
      expense_ledger: 'Libro de egresos',
      order_returns: 'Devoluciones y anulaciones de ventas',
      order_return_items: 'Ítems devueltos de ventas',
      orders: 'Órdenes de venta',
      order_items: 'Ítems de órdenes de venta',
      order_payments: 'Pagos de órdenes de venta',
      cash_sessions: 'Sesiones de caja',
      audit_logs: 'Auditoría interna del sistema',
    }
    return names[tableName] || `Actividad registrada sobre la tabla técnica "${tableName}"`
  } 

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs de Auditoría</h1>
          <p className="text-gray-600 mt-1">Registro completo de todos los movimientos del sistema</p>
        </div>
        <Button onClick={fetchLogs} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tabla</label>
              <select
                value={filters.table_name}
                onChange={(e) => handleFilterChange('table_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="">Todas</option>
                {TABLE_NAMES.map((table) => (
                  <option key={table} value={table}>
                    {getTableDisplayName(table)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Acción</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="">Todas</option>
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {getActionLabel(action)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ID de Registro</label>
              <Input
                type="text"
                value={filters.record_id}
                onChange={(e) => handleFilterChange('record_id', e.target.value)}
                placeholder="UUID del registro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ID de Usuario</label>
              <Input
                type="text"
                value={filters.user_id}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
                placeholder="UUID del usuario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Desde</label>
              <Input
                type="datetime-local"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Hasta</label>
              <Input
                type="datetime-local"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={clearFilters}>
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Registros ({totalCount})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No se encontraron registros de auditoría</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Fecha/Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Acción
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Usuario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        ID Registro
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Módulo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Resumen de cambio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDateTime(log.created_at, settings)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(
                              log.action
                            )}`}
                          >
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.user_email ? (
                            <span className="inline-flex items-center space-x-1">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{log.user_email}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">Sistema</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {log.record_id ? log.record_id.substring(0, 8) + '...' : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="inline-flex items-center space-x-1 text-gray-700">
                            <Database className="h-4 w-4 text-gray-400" />
                            <span className="text-xs">{getTableDisplayName(log.table_name)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-xs text-gray-700">{getChangeSummary(log)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
