import { ACTIVE_ORDER_STATUSES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'
import { Calendar, Download, Search, TrendingDown, UserPlus, Users2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type ScopeOrder = {
  id: string
  customer_id: string | null
  branch_id: string | null
  created_at: string
  total: number
  subtotal_before_discount: number
  discount_total: number
  shipping_address: unknown
}

type CustomerRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

type CustomerStats = {
  customerKey: string
  customerId: string | null
  customerName: string
  email: string | null
  phone: string | null
  ordersCount: number
  grossSales: number
  discounts: number
  netSales: number
  collected: number
  pending: number
  firstPurchase: string
  lastPurchase: string
}

type MonthlyCustomerPoint = {
  month: string
  activeCustomers: number
  netSales: number
}

type Summary = {
  activeCustomers: number
  newCustomers: number
  recurrentCustomers: number
  avgTicketPerCustomer: number
  avgOrdersPerCustomer: number
  grossSales: number
  discountsGranted: number
  netSales: number
  collectedIncome: number
}

type RecencyBuckets = {
  recent30: number
  atRisk31To90: number
  dormant90Plus: number
}

type SegmentFilter = 'all' | 'new' | 'recurrent' | 'at_risk' | 'with_pending'
type CustomerSortKey = 'net_sales' | 'pending' | 'orders' | 'last_purchase' | 'discounts'

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10)
const asNumber = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0)
const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const monthKey = (value: string): string => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const daysBetween = (fromIso: string, to: Date): number => {
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) return Number.POSITIVE_INFINITY
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

const getCustomerKey = (order: ScopeOrder): string => {
  if (order.customer_id) return `customer:${order.customer_id}`
  const shipping = asObject(order.shipping_address)
  const fullName = asString(shipping.fullName).trim().toLowerCase()
  const phone = asString(shipping.phone).trim().toLowerCase()
  const email = asString(shipping.email).trim().toLowerCase()
  return `guest:${fullName}|${phone}|${email}`
}

export function AdminCustomerReports() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()

  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 2)
    return toDateKey(date)
  })
  const [endDate, setEndDate] = useState(() => toDateKey(new Date()))

  const [draftBranchId, setDraftBranchId] = useState(selectedBranchId)
  const [draftStartDate, setDraftStartDate] = useState(startDate)
  const [draftEndDate, setDraftEndDate] = useState(endDate)

  const [summary, setSummary] = useState<Summary>({
    activeCustomers: 0,
    newCustomers: 0,
    recurrentCustomers: 0,
    avgTicketPerCustomer: 0,
    avgOrdersPerCustomer: 0,
    grossSales: 0,
    discountsGranted: 0,
    netSales: 0,
    collectedIncome: 0,
  })
  const [recency, setRecency] = useState<RecencyBuckets>({
    recent30: 0,
    atRisk31To90: 0,
    dormant90Plus: 0,
  })
  const [topCustomers, setTopCustomers] = useState<CustomerStats[]>([])
  const [atRiskCustomers, setAtRiskCustomers] = useState<CustomerStats[]>([])
  const [monthlySeries, setMonthlySeries] = useState<MonthlyCustomerPoint[]>([])
  const [customers, setCustomers] = useState<CustomerStats[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [sortKey, setSortKey] = useState<CustomerSortKey>('net_sales')
  const [visibleCustomers, setVisibleCustomers] = useState(100)

  const requestSeqRef = useRef(0)
  const hasEverLoaded = useRef(false)
  const invalidRange = draftStartDate > draftEndDate
  const hasPendingChanges =
    draftBranchId !== selectedBranchId || draftStartDate !== startDate || draftEndDate !== endDate

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId),
    [branches, selectedBranchId]
  )

  const filteredCustomers = useMemo(() => {
    const text = searchTerm.trim().toLowerCase()
    const withSegment = customers.filter((customer) => {
      if (segmentFilter === 'new') {
        const first = new Date(customer.firstPurchase)
        const rangeStart = new Date(`${startDate}T00:00:00`)
        const rangeEnd = new Date(`${endDate}T23:59:59`)
        return first >= rangeStart && first <= rangeEnd
      }
      if (segmentFilter === 'recurrent') {
        const first = new Date(customer.firstPurchase)
        const rangeStart = new Date(`${startDate}T00:00:00`)
        return first < rangeStart
      }
      if (segmentFilter === 'at_risk') {
        return daysBetween(customer.lastPurchase, new Date()) > 30
      }
      if (segmentFilter === 'with_pending') {
        return customer.pending > 0
      }
      return true
    })

    const withText = withSegment.filter((customer) => {
      if (!text) return true
      return [customer.customerName, customer.email || '', customer.phone || '']
        .join(' ')
        .toLowerCase()
        .includes(text)
    })

    return [...withText].sort((a, b) => {
      if (sortKey === 'pending') return b.pending - a.pending
      if (sortKey === 'orders') return b.ordersCount - a.ordersCount
      if (sortKey === 'last_purchase') return b.lastPurchase.localeCompare(a.lastPurchase)
      if (sortKey === 'discounts') return b.discounts - a.discounts
      return b.netSales - a.netSales
    })
  }, [customers, searchTerm, segmentFilter, sortKey, startDate, endDate])

  // Reset visible rows whenever the filtered result set changes
  useEffect(() => { setVisibleCustomers(100) }, [searchTerm, segmentFilter, sortKey, customers])

  const pendingPortfolio = useMemo(
    () => customers.reduce((sum, customer) => sum + customer.pending, 0),
    [customers]
  )

  const collectionRate = useMemo(() => {
    const totalCollected = customers.reduce((sum, customer) => sum + customer.collected, 0)
    const totalNet = customers.reduce((sum, customer) => sum + customer.netSales, 0)
    if (totalNet <= 0) return 0
    return (totalCollected / totalNet) * 100
  }, [customers])

  useEffect(() => {
    if (!organizationId) return
    fetchBranches()
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    fetchCustomerReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedBranchId, startDate, endDate])

  const fetchBranches = async () => {
    if (!organizationId) return
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code, organization_id, is_active, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching branches:', error)
      return
    }
    setBranches((data || []) as Branch[])
  }

  const fetchCustomerReport = async () => {
    if (!organizationId) return
    const requestId = ++requestSeqRef.current
    setLoading(true)

    try {
      let ordersQuery = supabase
        .from('orders')
        .select('id, customer_id, branch_id, created_at, total, subtotal_before_discount, discount_total, shipping_address')
        .eq('organization_id', organizationId)
        .in('status', ACTIVE_ORDER_STATUSES)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)

      if (selectedBranchId) {
        ordersQuery = ordersQuery.eq('branch_id', selectedBranchId)
      }

      const { data: ordersData, error: ordersError } = await ordersQuery
      if (ordersError) throw ordersError
      if (requestId !== requestSeqRef.current) return

      const periodOrders = (ordersData || []) as ScopeOrder[]
      const rangeStart = new Date(`${startDate}T00:00:00`)
      const rangeEnd = new Date(`${endDate}T23:59:59`)
      const now = new Date()

      const periodCustomerIds = [...new Set(periodOrders.map((o) => o.customer_id).filter(Boolean))] as string[]
      const customerMap = new Map<string, CustomerRow>()
      if (periodCustomerIds.length > 0) {
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('id, full_name, email, phone')
          .in('id', periodCustomerIds)
        if (customersError) throw customersError
        if (requestId !== requestSeqRef.current) return
        ;(customersData || []).forEach((c) => customerMap.set(c.id, c as CustomerRow))
      }

      let lifetimeRows: { customer_id: string | null; created_at: string }[] = []
      if (periodCustomerIds.length > 0) {
        let lifetimeQuery = supabase
          .from('orders')
          .select('customer_id, created_at')
          .eq('organization_id', organizationId)
          .in('status', ACTIVE_ORDER_STATUSES)
          .in('customer_id', periodCustomerIds)
        if (selectedBranchId) lifetimeQuery = lifetimeQuery.eq('branch_id', selectedBranchId)
        const { data: lifetimeData, error: lifetimeError } = await lifetimeQuery
        if (lifetimeError) throw lifetimeError
        if (requestId !== requestSeqRef.current) return
        lifetimeRows = (lifetimeData || []) as { customer_id: string | null; created_at: string }[]
      }

      const periodOrderIds = periodOrders.map((o) => o.id)
      let paymentsByOrder = new Map<string, number>()
      let collectedInPeriod = 0

      if (periodOrderIds.length > 0) {
        const { data: allPaymentsData, error: allPaymentsError } = await supabase
          .from('order_payments')
          .select('order_id, amount')
          .in('order_id', periodOrderIds)
        if (allPaymentsError) throw allPaymentsError
        if (requestId !== requestSeqRef.current) return

        paymentsByOrder = new Map<string, number>()
        ;(allPaymentsData || []).forEach((p) => {
          const current = paymentsByOrder.get(p.order_id) || 0
          paymentsByOrder.set(p.order_id, current + asNumber(p.amount))
        })

        const { data: periodPaymentsData, error: periodPaymentsError } = await supabase
          .from('order_payments')
          .select('order_id, amount, created_at')
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .in('order_id', periodOrderIds)
        if (periodPaymentsError) throw periodPaymentsError
        if (requestId !== requestSeqRef.current) return
        collectedInPeriod = (periodPaymentsData || []).reduce((sum, p) => sum + asNumber(p.amount), 0)
      }

      const firstPurchaseByCustomer = new Map<string, string>()
      const lastPurchaseByCustomer = new Map<string, string>()
      lifetimeRows.forEach((order) => {
        if (!order.customer_id) return
        const key = `customer:${order.customer_id}`
        const currentFirst = firstPurchaseByCustomer.get(key)
        if (!currentFirst || order.created_at < currentFirst) firstPurchaseByCustomer.set(key, order.created_at)
        const currentLast = lastPurchaseByCustomer.get(key)
        if (!currentLast || order.created_at > currentLast) lastPurchaseByCustomer.set(key, order.created_at)
      })
      periodOrders.forEach((order) => {
        if (order.customer_id) return
        const key = getCustomerKey(order)
        const currentFirst = firstPurchaseByCustomer.get(key)
        if (!currentFirst || order.created_at < currentFirst) firstPurchaseByCustomer.set(key, order.created_at)
        const currentLast = lastPurchaseByCustomer.get(key)
        if (!currentLast || order.created_at > currentLast) lastPurchaseByCustomer.set(key, order.created_at)
      })

      const statsMap = new Map<string, CustomerStats>()
      periodOrders.forEach((order) => {
        const key = getCustomerKey(order)
        const shipping = asObject(order.shipping_address)
        const linkedCustomer = order.customer_id ? customerMap.get(order.customer_id) : null
        const customerName =
          linkedCustomer?.full_name ||
          asString(shipping.fullName) ||
          (order.customer_id ? 'Cliente' : 'Cliente mostrador')
        const email = linkedCustomer?.email || asString(shipping.email) || null
        const phone = linkedCustomer?.phone || asString(shipping.phone) || null

        const grossSales = asNumber(order.subtotal_before_discount) || (asNumber(order.total) + asNumber(order.discount_total))
        const discounts = asNumber(order.discount_total)
        const netSales = asNumber(order.total)
        const collected = paymentsByOrder.get(order.id) || 0
        const pending = Math.max(netSales - collected, 0)

        const base = statsMap.get(key) || {
          customerKey: key,
          customerId: order.customer_id,
          customerName,
          email,
          phone,
          ordersCount: 0,
          grossSales: 0,
          discounts: 0,
          netSales: 0,
          collected: 0,
          pending: 0,
          firstPurchase: firstPurchaseByCustomer.get(key) || order.created_at,
          lastPurchase: lastPurchaseByCustomer.get(key) || order.created_at,
        }

        base.ordersCount += 1
        base.grossSales += grossSales
        base.discounts += discounts
        base.netSales += netSales
        base.collected += collected
        base.pending += pending
        base.firstPurchase = firstPurchaseByCustomer.get(key) || base.firstPurchase
        base.lastPurchase = lastPurchaseByCustomer.get(key) || base.lastPurchase
        statsMap.set(key, base)
      })

      const stats = [...statsMap.values()]
      const activeCustomers = stats.length
      const newCustomers = stats.filter((s) => {
        const first = new Date(s.firstPurchase)
        return first >= rangeStart && first <= rangeEnd
      }).length
      const recurrentCustomers = Math.max(activeCustomers - newCustomers, 0)
      const grossSales = stats.reduce((sum, s) => sum + s.grossSales, 0)
      const discountsGranted = stats.reduce((sum, s) => sum + s.discounts, 0)
      const netSales = stats.reduce((sum, s) => sum + s.netSales, 0)
      const totalOrders = stats.reduce((sum, s) => sum + s.ordersCount, 0)

      const recencyBuckets: RecencyBuckets = {
        recent30: 0,
        atRisk31To90: 0,
        dormant90Plus: 0,
      }
      stats.forEach((s) => {
        const days = daysBetween(s.lastPurchase, now)
        if (days <= 30) recencyBuckets.recent30 += 1
        else if (days <= 90) recencyBuckets.atRisk31To90 += 1
        else recencyBuckets.dormant90Plus += 1
      })

      const monthMap = new Map<string, { customers: Set<string>; netSales: number }>()
      periodOrders.forEach((order) => {
        const mk = monthKey(order.created_at)
        if (!mk) return
        const entry = monthMap.get(mk) || { customers: new Set<string>(), netSales: 0 }
        entry.customers.add(getCustomerKey(order))
        entry.netSales += asNumber(order.total)
        monthMap.set(mk, entry)
      })

      const monthly: MonthlyCustomerPoint[] = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, entry]) => ({
          month,
          activeCustomers: entry.customers.size,
          netSales: entry.netSales,
        }))

      setSummary({
        activeCustomers,
        newCustomers,
        recurrentCustomers,
        avgTicketPerCustomer: activeCustomers > 0 ? netSales / activeCustomers : 0,
        avgOrdersPerCustomer: activeCustomers > 0 ? totalOrders / activeCustomers : 0,
        grossSales,
        discountsGranted,
        netSales,
        collectedIncome: collectedInPeriod,
      })
      const statsByNetSales = [...stats].sort((a, b) => b.netSales - a.netSales)
      setCustomers(stats)
      setRecency(recencyBuckets)
      setTopCustomers(statsByNetSales.slice(0, 20))
      setAtRiskCustomers(
        [...stats]
          .filter((s) => {
            const days = daysBetween(s.lastPurchase, now)
            return days > 30
          })
          .sort((a, b) => daysBetween(b.lastPurchase, now) - daysBetween(a.lastPurchase, now))
          .slice(0, 20)
      )
      setMonthlySeries(monthly)
    } catch (error) {
      if (requestId !== requestSeqRef.current) return
      console.error('Error fetching customer reports:', error)
      show('No se pudo cargar el reporte de clientes.', 'error')
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false)
        hasEverLoaded.current = true
      }
    }
  }

  const applyFilters = () => {
    if (invalidRange) return
    setSelectedBranchId(draftBranchId)
    setStartDate(draftStartDate)
    setEndDate(draftEndDate)
  }

  const resetFilters = () => {
    const defaultStart = new Date()
    defaultStart.setMonth(defaultStart.getMonth() - 2)
    const start = toDateKey(defaultStart)
    const end = toDateKey(new Date())
    setDraftStartDate(start)
    setDraftEndDate(end)
    setDraftBranchId('')
    setStartDate(start)
    setEndDate(end)
    setSelectedBranchId('')
  }

  const defaultStart = (() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return toDateKey(d) })()
  const defaultEnd = toDateKey(new Date())
  const hasActiveFilters = draftBranchId !== '' || draftStartDate !== defaultStart || draftEndDate !== defaultEnd

  const exportCsv = async () => {
    try {
      setExporting(true)
      const rows: unknown[][] = []
      rows.push(['Reporte de Clientes'])
      rows.push(['Período', `${startDate} a ${endDate}`])
      rows.push(['Sucursal', selectedBranch?.name || 'Todas las sucursales'])
      rows.push([])
      rows.push(['Resumen'])
      rows.push([
        'Clientes activos',
        'Clientes nuevos',
        'Clientes recurrentes',
        'Ventas brutas',
        'Descuentos',
        'Ventas netas',
        'Cobros en período',
        'Ticket promedio por cliente',
        'Órdenes promedio por cliente',
      ])
      rows.push([
        summary.activeCustomers,
        summary.newCustomers,
        summary.recurrentCustomers,
        summary.grossSales,
        summary.discountsGranted,
        summary.netSales,
        summary.collectedIncome,
        summary.avgTicketPerCustomer,
        summary.avgOrdersPerCustomer,
      ])
      rows.push([])

      rows.push(['Clientes del período (según filtros de pantalla)'])
      rows.push(['Cliente', 'Email', 'Teléfono', 'Compras', 'Bruto', 'Descuentos', 'Neto', 'Cobrado', 'Pendiente', 'Última compra'])
      filteredCustomers.forEach((c) => {
        rows.push([
          c.customerName,
          c.email || '',
          c.phone || '',
          c.ordersCount,
          c.grossSales,
          c.discounts,
          c.netSales,
          c.collected,
          c.pending,
          c.lastPurchase ? formatDateShort(c.lastPurchase, settings) : '',
        ])
      })

      const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_clientes_${toDateKey(new Date()).replace(/-/g, '')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      show('Exportación de clientes completada.', 'success')
    } catch (error) {
      console.error('Error exporting customer report:', error)
      show('No se pudo exportar el reporte de clientes.', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (loading && !hasEverLoaded.current) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="animate-pulse rounded-xl bg-gray-200 h-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-gray-200 h-24" />
          ))}
        </div>
        <div className="animate-pulse rounded-xl bg-gray-200 h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Reporte de Clientes{' '}
            {loading && <span className="text-sm text-gray-400 font-normal animate-pulse">Actualizando...</span>}
          </h1>
          <p className="mt-1 text-gray-600">Recurrencia, valor por cliente, riesgo de abandono y cobranzas.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </div>

      <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Fecha inicio</label>
              <Input type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Fecha fin</label>
              <Input type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sucursal</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={draftBranchId}
                onChange={(event) => setDraftBranchId(event.target.value)}
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {invalidRange && <p className="mt-3 text-sm text-red-600">La fecha inicio no puede ser mayor que la fecha fin.</p>}

          <div className="mt-4 flex justify-end gap-2">
            {hasActiveFilters && (
              <Button variant="outline" onClick={resetFilters}>
                Limpiar
              </Button>
            )}
            <Button onClick={applyFilters} disabled={invalidRange || !hasPendingChanges}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Clientes activos</p>
            <p className="text-2xl font-bold text-gray-900">{summary.activeCustomers}</p>
            <p className="text-xs text-gray-500">Con compras en el período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Clientes nuevos</p>
                <p className="text-2xl font-bold text-gray-900">{summary.newCustomers}</p>
                <p className="text-xs text-gray-500">Primera compra en el período</p>
              </div>
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Clientes recurrentes</p>
            <p className="text-2xl font-bold text-gray-900">{summary.recurrentCustomers}</p>
            <p className="text-xs text-gray-500">Ya compraban antes del período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Ticket promedio por cliente</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.avgTicketPerCustomer, settings)}</p>
            <p className="text-xs text-gray-500">{summary.avgOrdersPerCustomer.toFixed(2)} órdenes por cliente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Ventas netas del período</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.netSales, settings)}</p>
            <p className="text-xs text-gray-500">
              Brutas {formatPrice(summary.grossSales, settings)} · Desc. {formatPrice(summary.discountsGranted, settings)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Cobros del período</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.collectedIncome, settings)}</p>
            <p className="text-xs text-gray-500">Ingreso real registrado en caja</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Cartera pendiente</p>
            <p className="text-2xl font-bold text-amber-700">{formatPrice(pendingPortfolio, settings)}</p>
            <p className="text-xs text-gray-500">Saldo por cobrar de clientes activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Tasa de cobranza</p>
            <p className="text-2xl font-bold text-gray-900">{collectionRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Cobrado / ventas netas del período</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              <span>Recencia de clientes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium text-gray-700">Última compra en últimos 30 días</p>
              <p className="mt-1 text-xl font-bold text-green-700">{recency.recent30}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium text-gray-700">En riesgo (31 a 90 días)</p>
              <p className="mt-1 text-xl font-bold text-amber-700">{recency.atRisk31To90}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium text-gray-700">Dormidos (+90 días)</p>
              <p className="mt-1 text-xl font-bold text-red-700">{recency.dormant90Plus}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              Cobros registrados en el período: <span className="font-semibold">{formatPrice(summary.collectedIncome, settings)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolución mensual (dentro del período)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySeries.length === 0 ? (
              <p className="text-sm text-gray-500">No hay datos para el período seleccionado.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlySeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [formatPrice(Number(v ?? 0), settings), 'Ventas netas']}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      labelFormatter={(l: any) => `Mes: ${l}`}
                    />
                    <Bar dataKey="netSales" name="Ventas netas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {monthlySeries.map(row => (
                    <div key={row.month} className="flex items-center justify-between text-xs text-gray-500 px-1">
                      <span>{row.month}</span>
                      <span>{row.activeCustomers} clientes · {formatPrice(row.netSales, settings)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Base de clientes del período</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative sm:min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                  placeholder="Buscar cliente, email o teléfono"
                />
              </div>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={segmentFilter}
                onChange={(event) => setSegmentFilter(event.target.value as SegmentFilter)}
              >
                <option value="all">Todos</option>
                <option value="new">Nuevos</option>
                <option value="recurrent">Recurrentes</option>
                <option value="at_risk">En riesgo</option>
                <option value="with_pending">Con saldo pendiente</option>
              </select>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as CustomerSortKey)}
              >
                <option value="net_sales">Ordenar por ventas netas</option>
                <option value="pending">Ordenar por saldo pendiente</option>
                <option value="orders">Ordenar por cantidad de compras</option>
                <option value="last_purchase">Ordenar por última compra</option>
                <option value="discounts">Ordenar por descuentos otorgados</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Mostrando {filteredCustomers.length} de {customers.length} clientes activos en el período.
          </p>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No hay clientes que cumplan los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cliente</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Compras</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Ventas netas</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Cobrado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Pendiente</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Descuentos</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.slice(0, visibleCustomers).map((customer) => (
                    <tr key={customer.customerKey}>
                      <td className="px-4 py-2 text-sm">
                        {customer.customerId ? (
                          <Link
                            to={`/customers/${customer.customerId}`}
                            className="font-medium text-admin-600 hover:underline"
                          >
                            {customer.customerName}
                          </Link>
                        ) : (
                          <p className="font-medium text-gray-800">{customer.customerName}</p>
                        )}
                        <p className="text-xs text-gray-500">{customer.email || customer.phone || 'Sin contacto'}</p>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">{customer.ordersCount}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(customer.netSales, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">{formatPrice(customer.collected, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-amber-700">{formatPrice(customer.pending, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-red-700">{formatPrice(customer.discounts, settings)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{formatDateShort(customer.lastPurchase, settings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredCustomers.length > visibleCustomers && (
            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={() => setVisibleCustomers((v) => v + 100)}
                className="h-9 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                Mostrar más ({filteredCustomers.length - visibleCustomers} restantes)
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top clientes por ventas netas</CardTitle>
        </CardHeader>
        <CardContent>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No hay clientes con ventas en el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cliente</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Compras</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Bruto</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Descuentos</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Neto</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Cobrado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Pendiente</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topCustomers.map((c) => (
                    <tr key={c.customerKey}>
                      <td className="px-4 py-2 text-sm">
                        {c.customerId ? (
                          <Link
                            to={`/customers/${c.customerId}`}
                            className="font-medium text-admin-600 hover:underline"
                          >
                            {c.customerName}
                          </Link>
                        ) : (
                          <p className="font-medium text-gray-800">{c.customerName}</p>
                        )}
                        <p className="text-xs text-gray-500">{c.email || c.phone || 'Sin contacto'}</p>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">{c.ordersCount}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">{formatPrice(c.grossSales, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-red-700">{formatPrice(c.discounts, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(c.netSales, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">{formatPrice(c.collected, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-amber-700">{formatPrice(c.pending, settings)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{formatDateShort(c.lastPurchase, settings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clientes en riesgo de abandono</CardTitle>
        </CardHeader>
        <CardContent>
          {atRiskCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No hay clientes en riesgo para este período.</p>
          ) : (
            <div className="space-y-2">
              {atRiskCustomers.map((c) => {
                const overdueDays = daysBetween(c.lastPurchase, new Date())
                return (
                  <div key={c.customerKey} className="flex items-center justify-between rounded border p-3">
                    <div>
                      {c.customerId ? (
                        <Link
                          to={`/customers/${c.customerId}`}
                          className="text-sm font-medium text-admin-600 hover:underline"
                        >
                          {c.customerName}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-gray-800">{c.customerName}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Última compra: {formatDateShort(c.lastPurchase, settings)} · {c.ordersCount} compras en período
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{overdueDays} días</p>
                      {overdueDays <= 90 ? (
                        <TrendingDown className="ml-auto h-4 w-4 text-amber-600" />
                      ) : (
                        <TrendingDown className="ml-auto h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
