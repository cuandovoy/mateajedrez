// src/pages/admin/AdminBillerComprobantes.tsx
// Historial de comprobantes fiscales electrónicos emitidos con Biller.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { obtenerPDF, BillerApiError, descargarPDFBlob } from '@/lib/biller'
import { useOrganization } from '@/hooks/useOrganization'
import { useBillerConfig } from '@/hooks/useBillerConfig'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePermission } from '@/hooks/usePermission'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Receipt, Search, Calendar, ChevronLeft, ChevronRight, ExternalLink, Download, Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Comprobante = {
  id: string
  order_id: string | null
  biller_id: number
  tipo_comprobante: number
  serie: string | null
  numero: number | null
  numero_interno: string | null
  estado: string
  created_at: string
  order?: { id: string; order_number: number | null; total: number | null } | null
}

const TIPO_LABEL: Record<number, string> = {
  101: 'e-Ticket',
  111: 'e-Factura',
}

const ESTADO_COLOR: Record<string, string> = {
  emitido: 'bg-teal-100 text-teal-700',
  anulado: 'bg-red-100 text-red-700',
  error: 'bg-orange-100 text-orange-700',
}

const ITEMS_PER_PAGE = 25

const formatOrderNumber = (order: { id: string; order_number: number | null } | null | undefined): string => {
  if (!order) return '—'
  if (order.order_number && order.order_number > 0) return `#${String(order.order_number).padStart(6, '0')}`
  return `#${order.id.slice(0, 8).toUpperCase()}`
}

export function AdminBillerComprobantes() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const { can, loading: permLoading } = usePermission()

  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const { config: billerConfig, loading: billerConfigLoading } = useBillerConfig(organizationId)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState(todayStr)
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'emitido' | 'anulado' | 'error'>('all')
  const [tipoFilter, setTipoFilter] = useState<'all' | '101' | '111'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchComprobantes = useCallback(async () => {
    if (!organizationId || !billerConfig) {
      setComprobantes([])
      setTotalCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('biller_comprobantes')
        .select(
          'id, order_id, biller_id, tipo_comprobante, serie, numero, numero_interno, estado, created_at, order:orders(id, order_number, total)',
          { count: 'exact' }
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (estadoFilter !== 'all') query = query.eq('estado', estadoFilter)
      if (tipoFilter !== 'all') query = query.eq('tipo_comprobante', Number(tipoFilter))

      const from = (currentPage - 1) * ITEMS_PER_PAGE
      query = query.range(from, from + ITEMS_PER_PAGE - 1)

      const { data, error, count } = await query
      if (error) throw error

      let filtered = (data ?? []) as Comprobante[]
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        filtered = filtered.filter((c) =>
          String(c.numero ?? '').includes(q) ||
          (c.serie ?? '').toLowerCase().includes(q) ||
          (c.numero_interno ?? '').toLowerCase().includes(q) ||
          String(c.biller_id).includes(q) ||
          (c.order ? formatOrderNumber(c.order).toLowerCase().includes(q) : false)
        )
      }

      setComprobantes(filtered)
      setTotalCount(count ?? 0)
    } catch (err) {
      console.error(err)
      show('Error al cargar los comprobantes', 'error')
    } finally {
      setLoading(false)
    }
  }, [organizationId, billerConfig, currentPage, startDate, endDate, estadoFilter, tipoFilter, searchTerm, show])

  useEffect(() => {
    fetchComprobantes()
  }, [fetchComprobantes])

  const handleDownloadPDF = async (c: Comprobante) => {
    if (!billerConfig) {
      show('No hay configuración de Biller disponible', 'error')
      return
    }
    setDownloadingId(c.id)
    try {
      const blob = await obtenerPDF(billerConfig, c.biller_id)
      descargarPDFBlob(blob, `cfe-${c.numero ?? c.biller_id}.pdf`)
    } catch (e) {
      show(e instanceof BillerApiError ? e.message : 'Error al descargar el PDF', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const handleResetFilters = () => {
    setStartDate('')
    setEndDate(todayStr)
    setEstadoFilter('all')
    setTipoFilter('all')
    setSearchTerm('')
    setCurrentPage(1)
  }

  if (permLoading) return <SkeletonTable rows={10} />
  if (!can('ventas:ver')) return null

  if (billerConfigLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
      </div>
    )
  }

  if (!billerConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Settings className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-900">Comprobantes Fiscales</h1>
          <p className="text-gray-500 mt-2">
            Esta organización no tiene integración de Biller configurada.
          </p>
          <Link to="/organizations" className="inline-block mt-4">
            <Button size="sm">Configurar Biller</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          <Receipt className="h-7 w-7 text-teal-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Comprobantes Fiscales</h1>
            <p className="text-gray-600 mt-1">Historial de e-Tickets y e-Facturas emitidos con Biller</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Nro, serie, orden..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setCurrentPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }}
            className={cn(
              'h-9 pl-9 pr-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500',
              startDate ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
            )}
          />
        </div>

        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }}
            className={cn(
              'h-9 pl-9 pr-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500',
              endDate !== todayStr ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
            )}
          />
        </div>

        <select
          value={tipoFilter}
          onChange={(e) => { setTipoFilter(e.target.value as typeof tipoFilter); setCurrentPage(1) }}
          className={cn(
            'h-9 border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500',
            tipoFilter !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
          )}
        >
          <option value="all">Todos los tipos</option>
          <option value="101">e-Ticket</option>
          <option value="111">e-Factura</option>
        </select>

        <select
          value={estadoFilter}
          onChange={(e) => { setEstadoFilter(e.target.value as typeof estadoFilter); setCurrentPage(1) }}
          className={cn(
            'h-9 border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500',
            estadoFilter !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
          )}
        >
          <option value="all">Todos los estados</option>
          <option value="emitido">Emitido</option>
          <option value="anulado">Anulado</option>
          <option value="error">Error</option>
        </select>

        {(startDate || estadoFilter !== 'all' || tipoFilter !== 'all' || searchTerm) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-9 px-3 rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 flex items-center gap-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comprobantes ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600" />
            </div>
          ) : comprobantes.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No se encontraron comprobantes</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {comprobantes.map((c) => (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {TIPO_LABEL[c.tipo_comprobante] ?? `Tipo ${c.tipo_comprobante}`}
                          {c.serie && c.numero ? ` · ${c.serie} ${c.numero}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">Biller ID: {c.biller_id}</p>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ESTADO_COLOR[c.estado] ?? 'bg-gray-100 text-gray-600')}>
                        {c.estado}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>{formatDateShort(c.created_at, settings)}</p>
                        {c.order && (
                          <p>Orden: {formatOrderNumber(c.order)} · {formatPrice(c.order.total ?? 0, settings)}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {c.order_id && (
                          <Link to={`/orders/${c.order_id}`}>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                        {c.estado === 'emitido' && billerConfig && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(c)}
                            disabled={downloadingId === c.id}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Serie / Nro</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Orden</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprobantes.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-sm text-gray-800">
                            {TIPO_LABEL[c.tipo_comprobante] ?? `Tipo ${c.tipo_comprobante}`}
                          </span>
                          <p className="text-xs text-gray-400">ID: {c.biller_id}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-gray-700">
                          {c.serie && c.numero ? `${c.serie} ${c.numero}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {c.order_id ? (
                            <Link
                              to={`/orders/${c.order_id}`}
                              className="text-sm font-medium text-admin-600 hover:underline flex items-center gap-1"
                            >
                              {formatOrderNumber(c.order)}
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Link>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {c.order?.total != null ? formatPrice(c.order.total, settings) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded-full text-xs font-medium', ESTADO_COLOR[c.estado] ?? 'bg-gray-100 text-gray-600')}>
                            {c.estado === 'emitido' ? 'Emitido' : c.estado === 'anulado' ? 'Anulado' : c.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDateShort(c.created_at, settings)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {c.order_id && (
                              <Link to={`/orders/${c.order_id}`}>
                                <Button variant="outline" size="sm">
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Orden
                                </Button>
                              </Link>
                            )}
                            {c.estado === 'emitido' && billerConfig && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDownloadPDF(c)}
                                disabled={downloadingId === c.id}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                {downloadingId === c.id ? '...' : 'PDF'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
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
