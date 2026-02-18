import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
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

export function CashSessionPayments({ sessionId, onClose }: CashSessionPaymentsProps) {
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
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center space-x-2">
              <Receipt className="h-6 w-6 text-admin-600" />
              <span>Ventas en Efectivo</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-6 py-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ventas Válidas</p>
                    <p className="text-2xl font-bold text-gray-900">{formatPrice(totalValidCash)}</p>
                    <p className="text-xs text-gray-500 mt-1">Lo que debería estar en caja</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Devoluciones</p>
                    <p className="text-2xl font-bold text-red-600">{formatPrice(totalCancelledCash)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {cancelledPayments.length === 0
                        ? 'Sin devoluciones'
                        : cancelledPayments.length === 1
                        ? '1 orden cancelada'
                        : `${cancelledPayments.length} órdenes canceladas`}
                    </p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <Receipt className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ventas (cantidad)</p>
                    <p className="text-2xl font-bold text-gray-900">{paymentCount}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ticket Promedio</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {paymentCount > 0 ? formatPrice(totalValidCash / paymentCount) : formatPrice(0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <Receipt className="h-6 w-6 text-purple-600" />
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
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Lista de Ventas</h3>
              <p className="text-sm text-gray-500 mb-4">
                Las órdenes canceladas (devoluciones) no suman al monto esperado en caja.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha/Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orden
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            <div>
                              <div>
                                {new Date(payment.created_at).toLocaleDateString('es-UY', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(payment.created_at).toLocaleTimeString('es-UY', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm">
                            {payment.order ? (
                              <div>
                                <div className="font-medium text-gray-900">
                                  Orden #{payment.order.id.slice(0, 8)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Total: {formatPrice(payment.order.total)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Orden no encontrada</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {payment.order && (
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                payment.order.status === 'delivered'
                                  ? 'bg-green-100 text-green-800'
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
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className={`text-sm font-semibold ${isCancelled ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                            {formatPrice(payment.amount)}
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
