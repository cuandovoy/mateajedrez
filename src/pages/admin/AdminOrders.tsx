import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ManualSaleForm } from '@/components/admin/ManualSaleForm'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { Search, Calendar, Filter, ChevronLeft, ChevronRight, Eye, Plus } from 'lucide-react'
import type { Order, CashSession, Branch } from '@/types'
import { cn } from '@/lib/utils'

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

const getStatusColor = (status: string | null): string => {
  const colorMap: Record<string, string> = {
    pending_allocation: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return (status && colorMap[status]) || 'bg-gray-100 text-gray-800'
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

type ShippingAddressLite = {
  fullName?: string
  email?: string
  phone?: string
  address?: string
}

type OrderWithPayments = Order & {
  order_payments?: OrderPaymentLite[] | null
  customer?: CustomerLite | null
}

const ITEMS_PER_PAGE = 20

export function AdminOrders() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<OrderWithPayments[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filters - Initialize from URL params
  const statusFromUrl = searchParams.get('status') as OrderStatus | null
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(
    statusFromUrl && ['pending_allocation', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(statusFromUrl)
      ? statusFromUrl
      : 'all'
  )
  const [discountFilter, setDiscountFilter] = useState<'all' | 'with_discount' | 'without_discount'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [openCashSessions, setOpenCashSessions] = useState<CashSession[]>([])
  const [saleBranchId, setSaleBranchId] = useState('')

  // Update URL when status filter changes
  useEffect(() => {
    if (statusFilter !== 'all') {
      setSearchParams({ status: statusFilter })
    } else {
      setSearchParams({})
    }
  }, [statusFilter, setSearchParams])

  useEffect(() => {
    if (organizationId) {
      fetchOrders()
      fetchBranches()
      fetchOpenCashSessions()
    }
  }, [organizationId, currentPage, startDate, endDate, statusFilter, discountFilter, searchTerm])

  const fetchBranches = async () => {
    if (!organizationId) return
    const { data } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')
    const list = (data || []) as Branch[]
    setBranches(list)
    if (list.length > 0 && !saleBranchId) setSaleBranchId(list[0].id)
  }

  const fetchOpenCashSessions = async () => {
    if (!organizationId) return
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .is('closed_at', null)
    setOpenCashSessions((data || []) as CashSession[])
  }

  const fetchOrders = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select('*, customer:customers(id, full_name, email, phone, rut), order_payments(id, amount, created_at)', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      // Apply date filters
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (discountFilter === 'with_discount') {
        query = query.gt('discount_total', 0)
      } else if (discountFilter === 'without_discount') {
        query = query.eq('discount_total', 0)
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      // Filter by search term (order ID, customer, shipping snapshot)
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

      setOrders(filteredData as OrderWithPayments[])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
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

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Órdenes</h1>
          <p className="text-gray-600 mt-1">Gestiona todas las órdenes de la tienda</p>
        </div>
        <Button
          onClick={() => setIsManualSaleOpen(true)}
          disabled={branches.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva orden
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="ID, nombre, teléfono..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Inicio
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Fin
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as OrderStatus | 'all')
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-200"
              >
                <option value="all">Todos</option>
                <option value="pending_allocation">Pend. asignación</option>
                <option value="pending">Pendiente</option>
                <option value="processing">En Proceso</option>
                <option value="shipped">Enviado</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento
              </label>
              <select
                value={discountFilter}
                onChange={(e) => {
                  setDiscountFilter(e.target.value as 'all' | 'with_discount' | 'without_discount')
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-200"
              >
                <option value="all">Todos</option>
                <option value="with_discount">Con descuento</option>
                <option value="without_discount">Sin descuento</option>
              </select>
            </div>
          </div>

          {(startDate || endDate || statusFilter !== 'all' || discountFilter !== 'all' || searchTerm) && (
            <div className="mt-4">
              <Button variant="outline" onClick={handleResetFilters}>
                Limpiar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Órdenes ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No se encontraron órdenes</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Orden</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Cliente</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Descuento</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Cobro</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const collectionStatus = getCollectionStatus(order)
                      const shippingAddress = order.shipping_address as ShippingAddressLite
                      const customerName = order.customer?.full_name || shippingAddress?.fullName || 'Cliente Invitado'
                      const customerEmail = order.customer?.email || shippingAddress?.email
                      const customerPhone = order.customer?.phone || shippingAddress?.phone
                      return (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-gray-900">{formatOrderDisplayNumber(order)}</p>
                              <p className="font-mono text-xs text-gray-500">{order.id.slice(0, 8)}...</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {customerName}
                              </p>
                              {(customerEmail || customerPhone) && (
                                <p className="text-sm text-gray-500">
                                  {[customerEmail, customerPhone].filter(Boolean).join(' · ')}
                                </p>
                              )}
                              {order.customer?.rut && (
                                <p className="text-xs text-gray-500">RUT: {order.customer.rut}</p>
                              )}
                              {order.customer?.id && (
                                <p className="text-[11px] font-medium text-emerald-700">Cliente vinculado</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDateShort(order.created_at, settings)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                getStatusColor(order.status)
                              )}
                            >
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {Number(order.discount_total || 0) > 0 ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                -{formatPrice(Number(order.discount_total), settings)}
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Sin descuento
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span
                                className={cn(
                                  'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                                  collectionStatus.color
                                )}
                              >
                                {collectionStatus.label}
                              </span>
                              <p className="text-xs text-gray-500">{collectionStatus.detail}</p>
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
              {totalPages > 1 && (
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

      {isManualSaleOpen && saleBranchId && (
        <ManualSaleForm
          branchId={saleBranchId}
          openCashSession={openCashSessions.find((s) => s.branch_id === saleBranchId) || null}
          openCashSessions={openCashSessions}
          branches={branches}
          onClose={() => setIsManualSaleOpen(false)}
          onSaleCreated={() => {
            setIsManualSaleOpen(false)
            fetchOrders()
          }}
          onBranchChange={(newBranchId) => setSaleBranchId(newBranchId)}
        />
      )}
    </div>
  )
}
