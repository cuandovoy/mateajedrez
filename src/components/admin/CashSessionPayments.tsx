import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { formatDateShort, formatPrice, formatTime } from '@/lib/utils'
import type { Order, OrderPayment } from '@/types'
import { Calendar, DollarSign, Receipt, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

interface CashSessionPaymentsProps {
  sessionId: string
  onClose: () => void
}

interface PaymentWithOrder extends OrderPayment {
  order: Order | null
}

const formatOrderDisplayNumber = (order: { id: string; order_number?: number | null }): string => {
  if (order.order_number && order.order_number > 0) return `#${String(order.order_number).padStart(6, '0')}`
  return `#${order.id.slice(0, 8).toUpperCase()}`
}

export function CashSessionPayments({ sessionId, onClose }: CashSessionPaymentsProps) {
  const settings = useOrgSettings()
  const [payments, setPayments] = useState<PaymentWithOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true)
      // Fetch payments for this session
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('order_payments')
        .select('*')
        .eq('cash_session_id', sessionId)
        .eq('payment_method', 'cash')
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      const payments = (paymentsData || []) as OrderPayment[]

      // Fetch orders for these payments
      const orderIds = [...new Set(payments.map((p: OrderPayment) => p.order_id))]
      
      let ordersMap = new Map<string, Order>()
      if (orderIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .in('id', orderIds)

        if (!ordersError && ordersData) {
          ordersMap = new Map((ordersData as Order[]).map((o) => [o.id, o]))
        }
      }

      const paymentsWithOrders: PaymentWithOrder[] = payments.map((payment) => ({
        ...payment,
        order: ordersMap.get(payment.order_id) || null,
      }))

      setPayments(paymentsWithOrders)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const validPayments = payments.filter((p) => p.order?.status !== 'cancelled')
  const cancelledPayments = payments.filter((p) => p.order?.status === 'cancelled')

  const totalValidCash = validPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalCancelledCash = cancelledPayments.reduce((sum, p) => sum + p.amount, 0)
  const paymentCount = validPayments.length

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
              <span>Ventas en Efectivo</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-4 py-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Ventas Válidas</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{formatPrice(totalValidCash, settings)}</p>
                    <p className="text-xs text-gray-500 mt-1">Lo que debería estar en caja</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Devoluciones</p>
                    <p className="text-lg sm:text-xl font-bold text-red-600">{formatPrice(totalCancelledCash, settings)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {cancelledPayments.length === 0
                        ? 'Sin devoluciones'
                        : cancelledPayments.length === 1
                        ? '1 orden cancelada'
                        : `${cancelledPayments.length} órdenes canceladas`}
                    </p>
                  </div>
                  <div className="bg-red-50 p-2 rounded-lg">
                    <Receipt className="h-5 w-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Ventas (cantidad)</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{paymentCount}</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Ticket Promedio</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                      {paymentCount > 0 ? formatPrice(totalValidCash / paymentCount, settings) : formatPrice(0, settings)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded-lg">
                    <Receipt className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payments List */}
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No hay ventas registradas en esta sesión</p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Lista de Ventas</h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Las órdenes canceladas (devoluciones) no suman al monto esperado en caja.
              </p>
              <div className="overflow-x-auto max-h-[52vh] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Fecha/Hora
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Orden
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[...validPayments, ...cancelledPayments].map((payment) => {
                      const isCancelled = payment.order?.status === 'cancelled'
                      return (
                      <tr
                        key={payment.id}
                        className={isCancelled ? 'bg-red-50/50 hover:bg-red-50/70' : 'hover:bg-gray-50'}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center text-xs sm:text-sm text-gray-900">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            <div>
                              <div>{formatDateShort(payment.created_at, settings)}</div>
                              <div className="text-xs text-gray-500">{formatTime(payment.created_at, settings)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-xs sm:text-sm">
                            {payment.order ? (
                              <div>
                                <div className="font-medium text-gray-900">
                                  Orden {formatOrderDisplayNumber(payment.order)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Total: {formatPrice(payment.order.total, settings)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Orden no encontrada</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {payment.order && (
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                payment.order.status === 'delivered'
                                  ? 'bg-green-100 text-green-800'
                                  : payment.order.status === 'pending_allocation'
                                  ? 'bg-orange-100 text-orange-800'
                                  : payment.order.status === 'processing'
                                  ? 'bg-blue-100 text-blue-800'
                                  : payment.order.status === 'shipped'
                                  ? 'bg-purple-100 text-purple-800'
                                  : payment.order.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {payment.order.status === 'pending'
                                ? 'Pendiente'
                                : payment.order.status === 'pending_allocation'
                                ? 'Pend. asignación'
                                : payment.order.status === 'processing'
                                ? 'En Proceso'
                                : payment.order.status === 'shipped'
                                ? 'Enviado'
                                : payment.order.status === 'delivered'
                                ? 'Entregado'
                                : 'Cancelado'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <div className={`text-xs sm:text-sm font-semibold ${isCancelled ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                            {formatPrice(payment.amount, settings)}
                            {isCancelled && (
                              <span className="ml-1 text-xs font-normal text-red-500">(devolución)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
