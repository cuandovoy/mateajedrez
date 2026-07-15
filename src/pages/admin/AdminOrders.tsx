import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useAdminBranches } from '@/hooks/useAdminBranches'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ManualSaleForm } from '@/components/admin/ManualSaleForm'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePermission } from '@/hooks/usePermission'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { PAGE_SIZE_ADMIN } from '@/lib/constants'
import { Search, Calendar, ChevronLeft, ChevronRight, Eye, Plus, ShoppingCart, X } from 'lucide-react'
import type { Order, CashSession } from '@/types'
import { cn } from '@/lib/utils'
import { getOrderStatusColor } from '@/lib/statusColors'

const formatOrderDisplayNumber = (order: { id: string; order_number?: number | null }): string => {
  if (order.order_number && order.order_number > 0) return `#${String(order.order_number).padStart(6, '0')}`
  return `#${order.id.slice(0, 8).toUpperCase()}`
}

const getStatusLabel = (status: string | null): string => {
  const statusMap: Record<string, string> = {
    pending_allocation: 'Pendiente de asignación',
    pending: 'Pendiente',
    processing: 'En Proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return (status && statusMap[status]) || status || 'Sin estado'
}

type OrderStatus = 'pending_allocation' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
type OrderPaymentLite = {
  id: string
  amount: number
  created_at: string
}
type CustomerLite = {
  id: string
  full_name: string
  email: string | null
  phone: string
  rut?: string | null
}
type BillerComprobanteLite = {
  id: string
  estado: string
  tipo_comprobante: number
}

type ShippingAddressLite = {
  fullName?: string
  full_name?: string
  name?: string
  email?: string
  phone?: string
  address?: string
}

type OrderWithPayments = Order & {
  order_payments?: OrderPaymentLite[] | null
  customer?: CustomerLite | null
  biller_comprobantes?: BillerComprobanteLite[] | null
}

const ITEMS_PER_PAGE = PAGE_SIZE_ADMIN

export function AdminOrders() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const queryClient = useQueryClient()
  const { can, loading: permLoading } = usePermission()
  const canManage = can('ventas:gestionar')
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentPage, setCurrentPage] = useState(1)
  const statusFromUrl = searchParams.get('status') as OrderStatus | null
  const todayStr = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState(todayStr)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(
    statusFromUrl && ['pending_allocation', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(statusFromUrl)
      ? statusFromUrl
      : 'all'
  )
  const [discountFilter, setDiscountFilter] = useState<'all' | 'with_discount' | 'without_discount'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [saleBranchId, setSaleBranchId] = useState('')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (statusFilter !== 'all') {
      setSearchParams({ status: statusFilter })
    } else {
      setSearchParams({})
    }
  }, [statusFilter, setSearchParams])

  const { data: branches = [] } = useAdminBranches(organizationId)

  useEffect(() => {
    if (branches.length > 0 && !saleBranchId) setSaleBranchId(branches[0].id)
  }, [branches, saleBranchId])

  const { data: openCashSessions = [] } = useQuery({
    queryKey: queryKeys.cashRegister.sessions(organizationId!, { open: true }),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('organization_id', organizationId!)
        .is('closed_at', null)
      if (error) throw error
      return (data || []) as CashSession[]
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  })

  const { data: ordersData, isPending: loading } = useQuery({
    queryKey: queryKeys.orders.list(organizationId!, { currentPage, startDate, endDate, statusFilter, discountFilter, searchTerm }),
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, customer:customers(id, full_name, email, phone, rut), order_payments(id, amount, created_at)', { count: 'exact' })
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (discountFilter === 'with_discount') query = query.gt('discount_total', 0)
      else if (discountFilter === 'without_discount') query = query.eq('discount_total', 0)

      if (searchTerm) {
        query = query.limit(500)
      } else {
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        query = query.range(from, from + ITEMS_PER_PAGE - 1)
      }

      const { data, error, count } = await query
      if (error) throw error

      let filteredData = data || []
      if (searchTerm) {
        filteredData = filteredData.filter((order) => {
          const orderId = (order as { id: string }).id.toLowerCase()
          const orderNumber = (order as { order_number?: number | null }).order_number
          const shippingAddress = (order as { shipping_address: ShippingAddressLite }).shipping_address
          const customer = (order as { customer?: CustomerLite | null }).customer
          const searchLower = searchTerm.toLowerCase()
          return (
            orderId.includes(searchLower) ||
            (orderNumber ? String(orderNumber).includes(searchTerm) : false) ||
            customer?.full_name?.toLowerCase().includes(searchLower) ||
            customer?.email?.toLowerCase().includes(searchLower) ||
            customer?.phone?.includes(searchTerm) ||
            customer?.rut?.toLowerCase().includes(searchLower) ||
            shippingAddress?.fullName?.toLowerCase().includes(searchLower) ||
            shippingAddress?.email?.toLowerCase().includes(searchLower) ||
            shippingAddress?.phone?.includes(searchTerm) ||
            shippingAddress?.address?.toLowerCase().includes(searchLower)
          )
        })
      }

      const orderIds = (filteredData as { id: string }[]).map((o) => o.id)
      let cfeMap: Record<string, BillerComprobanteLite> = {}
      if (orderIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cfeData } = await (supabase as any)
          .from('biller_comprobantes')
          .select('id, order_id, estado, tipo_comprobante')
          .in('order_id', orderIds)
          .eq('estado', 'emitido')
        if (cfeData) {
          for (const c of cfeData as (BillerComprobanteLite & { order_id: string })[]) {
            cfeMap[c.order_id] = c
          }
        }
      }

      const orders = (filteredData as OrderWithPayments[]).map((o) => ({
        ...o,
        biller_comprobantes: cfeMap[o.id] ? [cfeMap[o.id]] : [],
      }))
      return { orders, totalCount: searchTerm ? filteredData.length : (count || 0) }
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  })

  const orders = ordersData?.orders ?? []
  const totalCount = ordersData?.totalCount ?? 0

  // Realtime: invalidar caché cuando se inserta o actualiza una orden de esta org
  useEffect(() => {
    if (!organizationId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(organizationId) })

    const channel = supabase
      .channel(`orders:${organizationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `organization_id=eq.${organizationId}` }, invalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `organization_id=eq.${organizationId}` }, invalidate)
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [organizationId, queryClient])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const handleResetFilters = () => {
    setStartDate('')
    setEndDate(new Date().toISOString().split('T')[0])
    setStatusFilter('all')
    setDiscountFilter('all')
    setSearchTerm('')
    setCurrentPage(1)
  }

  const getCollectionStatus = (
    order: OrderWithPayments
  ): { label: string; color: string; detail: string } => {
    if (order.status === 'cancelled') {
      return {
        label: 'Sin cobro (anulada)',
        color: 'bg-gray-100 text-gray-700',
        detail: 'No admite nuevos cobros',
      }
    }

    const totalPaid = (order.order_payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const pendingAmount = Math.max(Number(order.total || 0) - totalPaid, 0)

    if (totalPaid > 0 && pendingAmount > 0) {
      return {
        label: 'Cobro parcial',
        color: 'bg-blue-100 text-blue-800',
        detail: `Debe ${formatPrice(pendingAmount, settings)}`,
      }
    }

    if (totalPaid > 0 && pendingAmount <= 0) {
      return {
        label: 'Cobrada',
        color: 'bg-green-100 text-green-800',
        detail: `Cobrado ${formatPrice(totalPaid, settings)}`,
      }
    }

    if (order.status === 'delivered') {
      return {
        label: 'Pendiente de cobro',
        color: 'bg-amber-100 text-amber-800',
        detail: `Debe ${formatPrice(pendingAmount, settings)}`,
      }
    }

    return {
      label: 'Sin cobro',
      color: 'bg-yellow-100 text-yellow-800',
      detail: `Debe ${formatPrice(pendingAmount, settings)}`,
    }
  }

  if (permLoading) return <SkeletonTable rows={PAGE_SIZE_ADMIN} />
  if (!can('ventas:ver')) return null

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Órdenes</h1>
          <p className="text-gray-600 mt-1">Gestiona todas las órdenes de la tienda</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsManualSaleOpen(true)}
            disabled={branches.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva orden
          </Button>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ID, nombre, teléfono..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setCurrentPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Limpiar búsqueda"
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
            className={`pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${startDate ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
            placeholder="Desde"
          />
        </div>
        <span className="text-gray-400 text-sm">—</span>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }}
            className={`pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${endDate ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
            placeholder="Hasta"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as OrderStatus | 'all'); setCurrentPage(1) }}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${statusFilter !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="all">Estado: todos</option>
          <option value="pending_allocation">Pend. asignación</option>
          <option value="pending">Pendiente</option>
          <option value="processing">En proceso</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select
          value={discountFilter}
          onChange={(e) => { setDiscountFilter(e.target.value as 'all' | 'with_discount' | 'without_discount'); setCurrentPage(1) }}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500 ${discountFilter !== 'all' ? 'border-admin-400 bg-admin-50 text-admin-800 font-medium' : 'border-gray-300 text-gray-700'}`}
        >
          <option value="all">Descuento: todos</option>
          <option value="with_discount">Con descuento</option>
          <option value="without_discount">Sin descuento</option>
        </select>
        {(startDate || statusFilter !== 'all' || discountFilter !== 'all' || searchTerm) && (
          <button
            onClick={handleResetFilters}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Órdenes ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && orders.length === 0 ? (
            <SkeletonTable rows={10} />
          ) : !loading && orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No se encontraron órdenes"
              description="Probá ajustar los filtros o el rango de fechas."
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {orders.map((order) => {
                  const collectionStatus = getCollectionStatus(order)
                  const shippingAddress = order.shipping_address as ShippingAddressLite
                  const shippingName = shippingAddress?.fullName || shippingAddress?.full_name || shippingAddress?.name
                  const customerName = order.customer?.full_name || shippingName || null
                  const isGuest = !order.customer?.id && !!shippingName
                  return (
                    <div key={order.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-semibold text-gray-900">{formatOrderDisplayNumber(order)}</p>
                            {order.biller_comprobantes && order.biller_comprobantes.length > 0 && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700">
                                CFE
                              </span>
                            )}
                            {Number(order.discount_total || 0) > 0 && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
                                -{formatPrice(Number(order.discount_total), settings)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            {customerName || 'Sin nombre'}
                            {isGuest && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600">
                                Invitado
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 shrink-0">{formatPrice(order.total, settings)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getOrderStatusColor(order.status))}>
                          {getStatusLabel(order.status)}
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', collectionStatus.color)}>
                          {collectionStatus.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">{formatDateShort(order.created_at, settings)}</p>
                        <Link to={`/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Orden</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Cliente</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado / Cobro</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const collectionStatus = getCollectionStatus(order)
                      const shippingAddress = order.shipping_address as ShippingAddressLite
                      const shippingName = shippingAddress?.fullName || shippingAddress?.full_name || shippingAddress?.name
                      const customerName = order.customer?.full_name || shippingName || null
                      const isGuest = !order.customer?.id && !!shippingName
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold text-gray-900">{formatOrderDisplayNumber(order)}</p>
                              {order.biller_comprobantes && order.biller_comprobantes.length > 0 && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700">
                                  CFE
                                </span>
                              )}
                              {Number(order.discount_total || 0) > 0 && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
                                  -{formatPrice(Number(order.discount_total), settings)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-gray-900">{customerName || 'Sin nombre'}</p>
                              {isGuest && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600">
                                  Invitado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDateShort(order.created_at, settings)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getOrderStatusColor(order.status))}>
                                {getStatusLabel(order.status)}
                              </span>
                              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', collectionStatus.color)}>
                                {collectionStatus.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {formatPrice(order.total, settings)}
                          </td>
                          <td className="py-3 px-4">
                            <Link to={`/orders/${order.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && !searchTerm && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} órdenes
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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

      {canManage && isManualSaleOpen && saleBranchId && (
        <ManualSaleForm
          branchId={saleBranchId}
          openCashSession={openCashSessions.find((s) => s.branch_id === saleBranchId) || null}
          openCashSessions={openCashSessions}
          branches={branches}
          onClose={() => setIsManualSaleOpen(false)}
          onSaleCreated={() => {
            setIsManualSaleOpen(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(organizationId!) })
          }}
          onBranchChange={(newBranchId) => setSaleBranchId(newBranchId)}
        />
      )}
    </div>
  )
}
