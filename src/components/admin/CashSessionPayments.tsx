import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { formatDateShort, formatPrice, formatTime } from '@/lib/utils'
import type { Order, OrderPayment } from '@/types'
import { DollarSign, ExternalLink, MinusCircle, Receipt, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'

interface CashSessionPaymentsProps {
  sessionId: string
  onClose: () => void
}

interface PaymentWithOrder extends OrderPayment {
  order: Order | null
}

interface OtherMethodOrder {
  order: Order
  paymentMethod: string
  amount: number
}

interface SessionDirectExpense {
  id: string
  occurred_at: string
  category: string
  description: string | null
  amount: number
  payment_method: string
}

const formatOrderDisplayNumber = (order: { id: string; order_number?: number | null }): string => {
  if (order.order_number && order.order_number > 0) return `#${String(order.order_number).padStart(6, '0')}`
  return `#${order.id.slice(0, 8).toUpperCase()}`
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  pending_allocation: 'Pend. asignación',
  processing: 'En Proceso',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_allocation: 'bg-orange-100 text-orange-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export function CashSessionPayments({ sessionId, onClose }: CashSessionPaymentsProps) {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const [payments, setPayments] = useState<PaymentWithOrder[]>([])
  const [otherOrders, setOtherOrders] = useState<OtherMethodOrder[]>([])
  const [directExpenses, setDirectExpenses] = useState<SessionDirectExpense[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    if (!organizationId) {
      setPayments([])
      setOtherOrders([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Fetch session metadata (branch + time window)
      const { data: sessionData } = await supabase
        .from('cash_sessions')
        .select('branch_id, opened_at, closed_at, branches!inner(organization_id)')
        .eq('id', sessionId)
        .eq('branches.organization_id', organizationId)
        .maybeSingle()

      if (!sessionData) {
        setPayments([])
        setOtherOrders([])
        return
      }

      // ── 1. Pagos vinculados a esta sesión (efectivo) ───────────────────────
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('order_payments')
        .select('*')
        .eq('cash_session_id', sessionId)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      const cashPayments = (paymentsData || []) as OrderPayment[]
      const cashOrderIds = [...new Set(cashPayments.map((p) => p.order_id))]

      let ordersMap = new Map<string, Order>()
      if (cashOrderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .in('id', cashOrderIds)
          .eq('organization_id', organizationId)
        if (ordersData) {
          ordersMap = new Map((ordersData as Order[]).map((o) => [o.id, o]))
        }
      }

      setPayments(
        cashPayments.map((p) => ({ ...p, order: ordersMap.get(p.order_id) || null }))
      )

      // ── 2. Órdenes del mismo branch creadas durante la sesión, con otros medios ──
      if (sessionData) {
        const { branch_id, opened_at, closed_at } = sessionData as {
          branch_id: string | null
          opened_at: string
          closed_at: string | null
        }

        if (branch_id) {
          const endTime = closed_at ?? new Date().toISOString()

          const { data: branchOrders } = await supabase
            .from('orders')
            .select('*')
            .eq('branch_id', branch_id)
            .eq('organization_id', organizationId)
            .gte('created_at', opened_at)
            .lte('created_at', endTime)
            .neq('status', 'cancelled')

          if (branchOrders && branchOrders.length > 0) {
            const branchOrderIds = (branchOrders as Order[]).map((o) => o.id)

            // Payments for those orders that are NOT linked to any cash session
            const { data: otherPaymentsData } = await supabase
              .from('order_payments')
              .select('*')
              .in('order_id', branchOrderIds)
              .is('cash_session_id', null)

            if (otherPaymentsData && otherPaymentsData.length > 0) {
              const ordersById = new Map((branchOrders as Order[]).map((o) => [o.id, o]))
              const seen = new Set<string>()

              const mapped: OtherMethodOrder[] = []
              for (const p of otherPaymentsData as OrderPayment[]) {
                if (seen.has(p.order_id)) continue
                seen.add(p.order_id)
                const order = ordersById.get(p.order_id)
                if (order) {
                  mapped.push({ order, paymentMethod: p.payment_method ?? '—', amount: p.amount })
                }
              }
              setOtherOrders(mapped)
            } else {
              setOtherOrders([])
            }
          } else {
            setOtherOrders([])
          }
        } else {
          setOtherOrders([])
        }
      }
      // ── 3. Gastos directos vinculados a esta sesión ────────────────────────
      const { data: expensesData } = await (supabase.from as any)('direct_expenses')
        .select('id, occurred_at, category, description, amount, payment_method')
        .eq('cash_session_id', sessionId)
        .order('occurred_at', { ascending: true })

      setDirectExpenses((expensesData || []) as SessionDirectExpense[])
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionId, organizationId])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const validPayments = payments.filter((p) => p.order && p.order.status !== 'cancelled')
  const cancelledPayments = payments.filter((p) => p.order?.status === 'cancelled')

  const totalValidCash = validPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalCancelledCash = cancelledPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalOtherMethods = otherOrders.reduce((sum, o) => sum + o.amount, 0)
  const totalDirectExpenses = directExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const paymentCount = validPayments.length

  const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
    combustible: 'Combustible',
    transporte: 'Transporte',
    alimentacion: 'Alimentación',
    papeleria: 'Papelería',
    servicios: 'Servicios',
    alquiler: 'Alquiler',
    mantenimiento: 'Mantenimiento',
    marketing: 'Marketing',
    varios: 'Varios',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[95vh] flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl sm:text-2xl flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-admin-600" />
              <span>Ventas de la sesión</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-4 py-4">

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 mb-1">Efectivo válido</p>
                <p className="text-lg font-bold text-gray-900">{formatPrice(totalValidCash, settings)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Lo que debería haber en caja</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 mb-1">Devoluciones</p>
                <p className="text-lg font-bold text-red-600">{formatPrice(totalCancelledCash, settings)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {cancelledPayments.length === 0 ? 'Sin devoluciones' : `${cancelledPayments.length} canceladas`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 mb-1">Otros medios</p>
                <p className="text-lg font-bold text-blue-700">{formatPrice(totalOtherMethods, settings)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {otherOrders.length === 0 ? 'Sin ventas' : `${otherOrders.length} orden${otherOrders.length !== 1 ? 'es' : ''}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 mb-1">Cant. ventas efectivo</p>
                <p className="text-lg font-bold text-gray-900">{paymentCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {paymentCount > 0 ? `Promedio ${formatPrice(totalValidCash / paymentCount, settings)}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 mb-1">Gastos de caja</p>
                <p className="text-lg font-bold text-red-600">- {formatPrice(totalDirectExpenses, settings)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {directExpenses.length === 0 ? 'Sin gastos' : `${directExpenses.length} gasto${directExpenses.length !== 1 ? 's' : ''}`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cash payments */}
          <div className="space-y-2 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Ventas en efectivo
            </h3>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 pl-6">No hay ventas en efectivo en esta sesión</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Fecha/Hora</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Orden</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Monto</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[...validPayments, ...cancelledPayments].map((payment) => {
                      const isCancelled = payment.order?.status === 'cancelled'
                      return (
                        <tr key={payment.id} className={isCancelled ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            <div>{formatDateShort(payment.created_at, settings)}</div>
                            <div className="text-xs text-gray-400">{formatTime(payment.created_at, settings)}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {payment.order ? (
                              <>
                                <div className="font-medium text-gray-900">{formatOrderDisplayNumber(payment.order)}</div>
                                <div className="text-xs text-gray-400">Total {formatPrice(payment.order.total, settings)}</div>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {payment.order && (
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLOR[payment.order.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                                {STATUS_LABEL[payment.order.status ?? ''] ?? payment.order.status}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            <span className={`font-semibold ${isCancelled ? 'text-red-500 line-through' : 'text-gray-900'}`}>
                              {formatPrice(payment.amount, settings)}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {payment.order && (
                              <Link to={`/orders/${payment.order.id}`} onClick={onClose}>
                                <Button variant="ghost" size="sm" className="h-7 px-2">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Other payment methods */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              Ventas con otros medios de pago
              <span className="text-xs font-normal text-gray-400">(no suman a la caja)</span>
            </h3>
            {otherOrders.length === 0 ? (
              <p className="text-sm text-gray-400 pl-6">No hay ventas con otros medios en esta sesión</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Fecha/Hora</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Orden</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Medio</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {otherOrders.map(({ order, paymentMethod, amount }) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          <div>{formatDateShort(order.created_at, settings)}</div>
                          <div className="text-xs text-gray-400">{formatTime(order.created_at, settings)}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{formatOrderDisplayNumber(order)}</div>
                          <div className="text-xs text-gray-400">Total {formatPrice(order.total, settings)}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 capitalize">
                            {paymentMethod}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLOR[order.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                            {STATUS_LABEL[order.status ?? ''] ?? order.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-gray-900">
                          {formatPrice(amount, settings)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link to={`/orders/${order.id}`} onClick={onClose}>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Direct expenses */}
          <div className="space-y-2 mt-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-red-500" />
              Gastos de caja
              <span className="text-xs font-normal text-gray-400">(restan del efectivo)</span>
            </h3>
            {directExpenses.length === 0 ? (
              <p className="text-sm text-gray-400 pl-6">No hay gastos registrados en esta sesión</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Descripción</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {directExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-red-50/30">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatDateShort(expense.occurred_at, settings)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{EXPENSE_CATEGORY_LABEL[expense.category] ?? expense.category}</td>
                        <td className="px-3 py-2 text-gray-600">{expense.description ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-red-600">- {formatPrice(Number(expense.amount), settings)}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-50">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-red-700">Total gastos</td>
                      <td className="px-3 py-2 text-right font-bold text-red-700">- {formatPrice(totalDirectExpenses, settings)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
