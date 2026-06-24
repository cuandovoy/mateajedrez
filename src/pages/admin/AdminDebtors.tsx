import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { usePermission } from '@/hooks/usePermission'
import { formatPrice, formatDateShort } from '@/lib/utils'
import { ACTIVE_ORDER_STATUSES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('598')) return digits
  if (digits.startsWith('0')) return '598' + digits.slice(1)
  return '598' + digits
}

function buildWhatsAppUrl(phone: string, name: string, pending: string): string {
  const number = toWhatsAppNumber(phone)
  const text = `Hola ${name}, te contactamos para recordarte que tenés un saldo pendiente de ${pending}. Cualquier consulta estamos a disposición.`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

interface Debtor {
  customerId: string
  customerName: string
  phone: string | null
  email: string | null
  pending: number
  orderCount: number
  lastOrder: string
}

async function fetchDebtors(organizationId: string): Promise<Debtor[]> {
  const { data: ordersRaw } = await (supabase as any)
    .from('orders')
    .select('id, customer_id, total, created_at, order_payments(amount)')
    .eq('organization_id', organizationId)
    .in('status', [...ACTIVE_ORDER_STATUSES])
    .not('customer_id', 'is', null)

  const customerMap = new Map<string, { pending: number; orderCount: number; lastOrder: string }>()
  for (const order of ordersRaw ?? []) {
    if (!order.customer_id) continue
    const paid = (order.order_payments ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount || 0), 0)
    const pending = Math.max(Number(order.total || 0) - paid, 0)
    if (pending < 0.01) continue
    const prev = customerMap.get(order.customer_id)
    if (prev) {
      prev.pending += pending
      prev.orderCount += 1
      if (order.created_at > prev.lastOrder) prev.lastOrder = order.created_at
    } else {
      customerMap.set(order.customer_id, { pending, orderCount: 1, lastOrder: order.created_at })
    }
  }

  const debtorIds = [...customerMap.keys()]
  if (debtorIds.length === 0) return []

  const { data: customersRaw } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .in('id', debtorIds)
    .eq('organization_id', organizationId)

  const debtors = (customersRaw ?? []).map((c: { id: string; full_name: string; phone: string | null; email: string | null }) => ({
    customerId: c.id,
    customerName: c.full_name,
    phone: c.phone,
    email: c.email,
    ...customerMap.get(c.id)!,
  })).sort((a, b) => b.pending - a.pending)

  return debtors
}

export function AdminDebtors() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { can, loading: permLoading } = usePermission()

  const { data: debtors = [], isPending: loading } = useQuery({
    queryKey: ['admin', organizationId, 'debtors'],
    queryFn: () => fetchDebtors(organizationId!),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  })

  const totalDebt = debtors.reduce((s, d) => s + d.pending, 0)

  if (permLoading) return <SkeletonTable rows={10} />
  if (!can('clientes:ver')) return null

  const handleExport = () => {
    const headers = ['Cliente', 'Teléfono', 'Email', 'Deuda total', 'Órdenes con deuda', 'Última compra']
    const rows = debtors.map((d) => [
      d.customerName,
      d.phone ?? '',
      d.email ?? '',
      String(d.pending.toFixed(2)),
      String(d.orderCount),
      d.lastOrder ? new Date(d.lastOrder).toLocaleDateString('es-UY') : '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deudores.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deudores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Clientes con saldo pendiente de cobro</p>
        </div>
        {!loading && debtors.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Summary chips */}
      {!loading && debtors.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800 font-medium">
              Deuda total: <span className="font-bold">{formatPrice(totalDebt, settings)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-700 font-medium">
              {debtors.length} {debtors.length === 1 ? 'deudor' : 'deudores'}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes con deuda pendiente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={8} />
            </div>
          ) : debtors.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={CheckCircle}
                title="Sin deudores"
                description="Todos los clientes tienen sus órdenes al día."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Deuda total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Órdenes con deuda
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Última compra
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {debtors.map((d) => (
                    <tr key={d.customerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/customers/${d.customerId}`}
                          className="font-medium text-admin-600 hover:underline"
                        >
                          {d.customerName}
                        </Link>
                        {d.email && (
                          <p className="text-xs text-gray-400 mt-0.5">{d.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {d.phone ? (
                          <div className="flex items-center gap-2">
                            <span>{d.phone}</span>
                            <a
                              href={buildWhatsAppUrl(d.phone, d.customerName, formatPrice(d.pending, settings))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 text-green-600 hover:text-green-700 transition-colors"
                              title="Enviar mensaje por WhatsApp"
                            >
                              <WhatsAppIcon className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-amber-700">
                        {formatPrice(d.pending, settings)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {d.orderCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {d.lastOrder ? formatDateShort(d.lastOrder, settings) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
