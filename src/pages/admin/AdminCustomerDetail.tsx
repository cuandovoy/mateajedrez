import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePermission } from '@/hooks/usePermission'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatPrice, formatDateShort } from '@/lib/utils'
import { ArrowLeft, ShoppingCart, DollarSign, Calendar, Package, Plus, Edit2, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { ACTIVE_ORDER_STATUSES } from '@/lib/constants'

const ORDERS_PREVIEW_LIMIT = 100
import { useToastStore } from '@/store/toastStore'
import type { Customer } from '@/types/database.types'
import { cn } from '@/lib/utils'

const getStatusLabel = (status: string | null): string => {
  const map: Record<string, string> = {
    pending_allocation: 'Pend. asignación',
    pending: 'Pendiente',
    processing: 'En proceso',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  }
  return (status && map[status]) || status || 'Sin estado'
}

const getStatusColor = (status: string | null): string => {
  const map: Record<string, string> = {
    pending_allocation: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return (status && map[status]) || 'bg-gray-100 text-gray-800'
}

interface TopProduct {
  name: string
  sku: string
  quantity: number
}

export function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { can, loading: permLoading } = usePermission()
  const { show } = useToastStore()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', rut: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [ordersVisible, setOrdersVisible] = useState(20)

  const { data, isPending: loading } = useQuery({
    queryKey: queryKeys.customers.detail(organizationId!, id!),
    queryFn: async () => {
      const [customerRes, ordersRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id!).eq('organization_id', organizationId!).single(),
        supabase
          .from('orders')
          .select('*, order_items(id, quantity, price, product_id, products(name, sku))')
          .eq('organization_id', organizationId!)
          .eq('customer_id', id!)
          .order('created_at', { ascending: false })
          .limit(ORDERS_PREVIEW_LIMIT),
      ])
      if (customerRes.error) throw customerRes.error
      if (ordersRes.error) throw ordersRes.error

      const orders = (ordersRes.data ?? []) as any[]
      const orderIds = orders.map((o) => o.id)

      const paymentsByOrderId: Record<string, number> = {}
      if (orderIds.length > 0) {
        const { data: paymentsRaw } = await supabase
          .from('order_payments')
          .select('order_id, amount')
          .in('order_id', orderIds)
        for (const p of paymentsRaw ?? []) {
          paymentsByOrderId[p.order_id] = (paymentsByOrderId[p.order_id] || 0) + Number(p.amount || 0)
        }
      }

      return {
        customer: customerRes.data as Customer,
        orders,
        paymentsByOrderId,
      }
    },
    enabled: !!organizationId && !!id,
    staleTime: 5 * 60 * 1000,
  })

  const customer = data?.customer ?? null
  const orders = data?.orders ?? []
  const paymentsByOrderId = data?.paymentsByOrderId ?? {}

  const topProducts = useMemo<TopProduct[]>(() => {
    const productMap = new Map<string, { name: string; sku: string; quantity: number }>()
    for (const order of orders) {
      for (const item of order.order_items || []) {
        const name = item.products?.name || 'Producto'
        const sku = item.products?.sku || ''
        const key = item.product_id || name
        const prev = productMap.get(key)
        if (prev) {
          prev.quantity += item.quantity || 1
        } else {
          productMap.set(key, { name, sku, quantity: item.quantity || 1 })
        }
      }
    }
    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [orders])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const openEdit = () => {
    if (!customer) return
    setEditForm({
      full_name: customer.full_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      rut: customer.rut || '',
      notes: customer.notes || '',
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!customer || !organizationId || !editForm.full_name.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: editForm.full_name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || '',
          rut: editForm.rut.trim() || null,
          notes: editForm.notes.trim() || null,
        })
        .eq('id', customer.id)
        .eq('organization_id', organizationId)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(organizationId, id!) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all(organizationId) })
      setEditOpen(false)
    } catch {
      show('No se pudo guardar los cambios.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!customer) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Cliente no encontrado.</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Volver a clientes</Button>
      </div>
    )
  }

  const completedOrders = orders.filter((o) => (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status || ''))
  const totalSpent = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)

  const pendingByOrder = new Map<string, number>()
  for (const order of completedOrders) {
    const paid = paymentsByOrderId[order.id] ?? 0
    pendingByOrder.set(order.id, Math.max(Number(order.total || 0) - paid, 0))
  }
  const totalPending = [...pendingByOrder.values()].reduce((s, v) => s + v, 0)

  const firstOrder = orders[orders.length - 1]
  const lastOrder = orders[0]
  const address = (customer.address || {}) as any
  const canManage = can('clientes:gestionar')

  if (permLoading) return <SkeletonTable rows={8} />
  if (!can('clientes:ver')) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{customer.full_name}</h1>
            {!customer.is_active && (
              <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                Inactivo
              </span>
            )}
          </div>
          {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canManage && (
            <Button variant="outline" onClick={openEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canManage && (
            <Button onClick={() => navigate(`/orders?customer_id=${id}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva orden
            </Button>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-green-50 p-2.5 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total gastado</p>
              <p className="text-xl font-bold text-gray-900">{formatPrice(totalSpent, settings)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Órdenes totales</p>
              <p className="text-xl font-bold text-gray-900">{completedOrders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Primera compra</p>
              <p className="text-sm font-semibold text-gray-900">
                {firstOrder ? formatDateShort(firstOrder.created_at, settings) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="bg-orange-50 p-2.5 rounded-lg">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Última compra</p>
              <p className="text-sm font-semibold text-gray-900">
                {lastOrder ? formatDateShort(lastOrder.created_at, settings) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        {totalPending > 0.01 && (
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="bg-amber-50 p-2.5 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Saldo pendiente</p>
                <p className="text-xl font-bold text-amber-700">{formatPrice(totalPending, settings)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Historial de órdenes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <p className="text-center py-10 text-gray-500 text-sm">Sin órdenes registradas</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.slice(0, ordersVisible).map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            <Link
                              to={`/orders/${order.id}`}
                              className="font-medium text-admin-600 hover:underline"
                            >
                              #{order.order_number ? String(order.order_number).padStart(6, '0') : order.id.slice(0, 8).toUpperCase()}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateShort(order.created_at, settings)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(order.status))}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            {formatPrice(order.total || 0, settings)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {order.status === 'cancelled' ? (
                              <span className="text-gray-300">—</span>
                            ) : (pendingByOrder.get(order.id) ?? 0) > 0.01 ? (
                              <span className="font-semibold text-amber-700">
                                {formatPrice(pendingByOrder.get(order.id)!, settings)}
                              </span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length > ordersVisible && (
                    <div className="px-4 py-3 border-t border-gray-100 text-center">
                      <button
                        onClick={() => setOrdersVisible(v => v + 20)}
                        className="text-sm text-admin-600 hover:text-admin-700 font-medium"
                      >
                        Mostrar más ({orders.length - ordersVisible} restantes)
                      </button>
                    </div>
                  )}
                  {orders.length >= ORDERS_PREVIEW_LIMIT && (
                    <div className="px-4 py-3 border-t border-gray-100 text-center text-xs text-gray-400">
                      Mostrando las últimas {ORDERS_PREVIEW_LIMIT} órdenes.{' '}
                      <button
                        onClick={() => navigate(`/orders?customer_id=${id}`)}
                        className="text-admin-600 hover:underline"
                      >
                        Ver historial completo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: contact + top products */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Datos de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
              {customer.phone && (
                <p>
                  <span className="text-gray-500">Tel:</span>{' '}
                  <a href={`tel:${customer.phone}`} className="text-admin-600 hover:underline">{customer.phone}</a>
                </p>
              )}
              {customer.email && (
                <p>
                  <span className="text-gray-500">Email:</span>{' '}
                  <a href={`mailto:${customer.email}`} className="text-admin-600 hover:underline">{customer.email}</a>
                </p>
              )}
              {customer.rut && <p><span className="text-gray-500">RUT:</span> {customer.rut}</p>}
              {address?.address && (
                <p>
                  <span className="text-gray-500">Dirección:</span>{' '}
                  {[address.address, address.city, address.state].filter(Boolean).join(', ')}
                </p>
              )}
              {customer.notes && (
                <p className="mt-2 text-gray-500 italic">{customer.notes}</p>
              )}
            </CardContent>
          </Card>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Productos más comprados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                      {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                    </div>
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      ×{p.quantity}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Editar cliente</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                  <input
                    type="text"
                    value={editForm.rut}
                    onChange={e => setEditForm(f => ({ ...f, rut: e.target.value }))}
                    className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-admin-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving || !editForm.full_name.trim()}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
