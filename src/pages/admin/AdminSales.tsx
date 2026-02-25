import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { formatDateShort, formatPrice } from '@/lib/utils'
import type { Branch } from '@/types'
import {
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Download,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type PeriodMode = 'month' | 'custom'

type DailySale = {
  date: string
  orders: number
  revenue: number
}

type MonthlySale = {
  month: string
  orders: number
  revenue: number
}

type PaymentMethodSummary = {
  method: string
  label: string
  amount: number
}

type BranchSummary = {
  branch_id: string
  branch_name: string
  orders: number
  revenue: number
}

type SummaryCurrent = {
  revenue: number
  orders: number
  avgTicket: number
}

type SummaryPrevious = {
  revenue: number
  orders: number
}

type MarginSummary = {
  grossMargin: number
  trackedCost: number
  trackedRevenue: number
  marginPct: number
  trackedItems: number
  totalItems: number
  missingItems: number
  branchMissingItems: number
  inventoryCostMissingItems: number
  otherMissingItems: number
}

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    mercadopago: 'Mercado Pago',
    credit_card: 'Crédito',
    debit_card: 'Débito',
    transfer: 'Transferencia',
  }
  return labels[method] || method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const toDateKey = (date: Date): string => date.toISOString().split('T')[0]

const monthRangeFromValue = (value: string): { start: Date; end: Date } => {
  const [year, month] = value.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const dateInputRange = (startDate: string, endDate: string): { start: Date; end: Date } => {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const compareRange = (start: Date, end: Date): { start: Date; end: Date } => {
  const diff = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diff)
  return { start: prevStart, end: prevEnd }
}

const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

const monthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-UY', {
    month: 'long',
    year: 'numeric',
  })
}

const escapeCsv = (value: string | number): string => {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const asNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

export function AdminSales() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()

  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [customStart, setCustomStart] = useState(() => toDateKey(new Date()))
  const [customEnd, setCustomEnd] = useState(() => toDateKey(new Date()))
  const [draftSelectedBranchId, setDraftSelectedBranchId] = useState(selectedBranchId)
  const [draftPeriodMode, setDraftPeriodMode] = useState<PeriodMode>(periodMode)
  const [draftSelectedMonth, setDraftSelectedMonth] = useState(selectedMonth)
  const [draftCustomStart, setDraftCustomStart] = useState(customStart)
  const [draftCustomEnd, setDraftCustomEnd] = useState(customEnd)

  const [loading, setLoading] = useState(true)
  const [currentSummary, setCurrentSummary] = useState<SummaryCurrent>({
    revenue: 0,
    orders: 0,
    avgTicket: 0,
  })
  const [previousSummary, setPreviousSummary] = useState<SummaryPrevious>({
    revenue: 0,
    orders: 0,
  })
  const [currentMargin, setCurrentMargin] = useState<MarginSummary>({
    grossMargin: 0,
    trackedCost: 0,
    trackedRevenue: 0,
    marginPct: 0,
    trackedItems: 0,
    totalItems: 0,
    missingItems: 0,
    branchMissingItems: 0,
    inventoryCostMissingItems: 0,
    otherMissingItems: 0,
  })
  const [previousMargin, setPreviousMargin] = useState<MarginSummary>({
    grossMargin: 0,
    trackedCost: 0,
    trackedRevenue: 0,
    marginPct: 0,
    trackedItems: 0,
    totalItems: 0,
    missingItems: 0,
    branchMissingItems: 0,
    inventoryCostMissingItems: 0,
    otherMissingItems: 0,
  })
  const [dailySales, setDailySales] = useState<DailySale[]>([])
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([])
  const [paymentMethodSales, setPaymentMethodSales] = useState<PaymentMethodSummary[]>([])
  const [branchSummary, setBranchSummary] = useState<BranchSummary[]>([])

  const requestSequenceRef = useRef(0)

  useEffect(() => {
    if (organizationId) {
      fetchBranches()
    }
  }, [organizationId])

  const range = useMemo(() => {
    if (periodMode === 'month') {
      return monthRangeFromValue(selectedMonth)
    }
    return dateInputRange(customStart, customEnd)
  }, [periodMode, selectedMonth, customStart, customEnd])

  const comparison = useMemo(() => compareRange(range.start, range.end), [range])

  useEffect(() => {
    if (organizationId) {
      fetchReportData()
    }
  }, [organizationId, selectedBranchId, range.start.getTime(), range.end.getTime(), comparison.start.getTime(), comparison.end.getTime()])

  const fetchBranches = async () => {
    if (!organizationId) return

    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, code, organization_id, is_active, created_at, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setBranches((data || []) as Branch[])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchReportData = async () => {
    if (!organizationId) return

    if (periodMode === 'custom' && customStart > customEnd) {
      return
    }

    const monthlyStart = new Date(range.end)
    monthlyStart.setDate(1)
    monthlyStart.setMonth(monthlyStart.getMonth() - 11)
    monthlyStart.setHours(0, 0, 0, 0)

    const requestId = ++requestSequenceRef.current
    setLoading(true)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_sales_report_summary', {
        p_organization_id: organizationId,
        p_range_start: range.start.toISOString(),
        p_range_end: range.end.toISOString(),
        p_compare_start: comparison.start.toISOString(),
        p_compare_end: comparison.end.toISOString(),
        p_monthly_start: monthlyStart.toISOString(),
        p_branch_id: selectedBranchId || null,
      })

      if (error) throw error
      if (requestId !== requestSequenceRef.current) return

      const payload = (data || {}) as Record<string, unknown>

      const current = (payload.current as Record<string, unknown> | undefined) || {}
      const previous = (payload.previous as Record<string, unknown> | undefined) || {}

      setCurrentSummary({
        revenue: asNumber(current.revenue),
        orders: asNumber(current.orders),
        avgTicket: asNumber(current.avg_ticket),
      })

      setPreviousSummary({
        revenue: asNumber(previous.revenue),
        orders: asNumber(previous.orders),
      })

      const currentMarginPayload = (payload.current_margin as Record<string, unknown> | undefined) || {}
      setCurrentMargin({
        grossMargin: asNumber(currentMarginPayload.gross_margin),
        trackedCost: asNumber(currentMarginPayload.tracked_cost),
        trackedRevenue: asNumber(currentMarginPayload.tracked_revenue),
        marginPct: asNumber(currentMarginPayload.margin_pct),
        trackedItems: asNumber(currentMarginPayload.tracked_items),
        totalItems: asNumber(currentMarginPayload.total_items),
        missingItems: asNumber(currentMarginPayload.missing_items),
        branchMissingItems: asNumber(currentMarginPayload.branch_missing_items),
        inventoryCostMissingItems: asNumber(currentMarginPayload.inventory_cost_missing_items),
        otherMissingItems: asNumber(currentMarginPayload.other_missing_items),
      })

      const previousMarginPayload = (payload.previous_margin as Record<string, unknown> | undefined) || {}
      setPreviousMargin({
        grossMargin: asNumber(previousMarginPayload.gross_margin),
        trackedCost: asNumber(previousMarginPayload.tracked_cost),
        trackedRevenue: asNumber(previousMarginPayload.tracked_revenue),
        marginPct: asNumber(previousMarginPayload.margin_pct),
        trackedItems: asNumber(previousMarginPayload.tracked_items),
        totalItems: asNumber(previousMarginPayload.total_items),
        missingItems: asNumber(previousMarginPayload.missing_items),
        branchMissingItems: asNumber(previousMarginPayload.branch_missing_items),
        inventoryCostMissingItems: asNumber(previousMarginPayload.inventory_cost_missing_items),
        otherMissingItems: asNumber(previousMarginPayload.other_missing_items),
      })

      const daily = Array.isArray(payload.daily) ? payload.daily : []
      setDailySales(
        daily.map((item) => {
          const row = item as Record<string, unknown>
          return {
            date: asString(row.date),
            orders: asNumber(row.orders),
            revenue: asNumber(row.revenue),
          }
        })
      )

      const monthly = Array.isArray(payload.monthly) ? payload.monthly : []
      setMonthlySales(
        monthly.map((item) => {
          const row = item as Record<string, unknown>
          return {
            month: asString(row.month),
            orders: asNumber(row.orders),
            revenue: asNumber(row.revenue),
          }
        })
      )

      const methods = Array.isArray(payload.payment_methods) ? payload.payment_methods : []
      setPaymentMethodSales(
        methods.map((item) => {
          const row = item as Record<string, unknown>
          const method = asString(row.method)
          return {
            method,
            label: getPaymentMethodLabel(method),
            amount: asNumber(row.amount),
          }
        })
      )

      const branchesData = Array.isArray(payload.branches) ? payload.branches : []
      setBranchSummary(
        branchesData.map((item) => {
          const row = item as Record<string, unknown>
          return {
            branch_id: asString(row.branch_id),
            branch_name: asString(row.branch_name) || 'Sin sucursal',
            orders: asNumber(row.orders),
            revenue: asNumber(row.revenue),
          }
        })
      )
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return
      console.error('Error fetching sales report data:', error)
    } finally {
      if (requestId === requestSequenceRef.current) {
        setLoading(false)
      }
    }
  }

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)
  const invalidDraftCustomRange = draftPeriodMode === 'custom' && draftCustomStart > draftCustomEnd
  const hasPendingFilterChanges =
    draftSelectedBranchId !== selectedBranchId ||
    draftPeriodMode !== periodMode ||
    draftSelectedMonth !== selectedMonth ||
    draftCustomStart !== customStart ||
    draftCustomEnd !== customEnd

  const comparisonSummary = useMemo(() => {
    return {
      prevRevenue: previousSummary.revenue,
      prevOrders: previousSummary.orders,
      prevMargin: previousMargin.grossMargin,
      revenueChange: percentChange(currentSummary.revenue, previousSummary.revenue),
      ordersChange: percentChange(currentSummary.orders, previousSummary.orders),
      marginChange: percentChange(currentMargin.grossMargin, previousMargin.grossMargin),
    }
  }, [currentSummary, previousSummary, currentMargin, previousMargin])

  const marginCoveragePct = currentMargin.totalItems > 0
    ? (currentMargin.trackedItems / currentMargin.totalItems) * 100
    : 0

  const periodLabel =
    periodMode === 'month'
      ? monthLabel(selectedMonth)
      : `${formatDateShort(range.start, settings)} - ${formatDateShort(range.end, settings)}`

  const handleExport = () => {
    const rows: Array<Array<string | number>> = []

    rows.push(['Reporte de Ventas'])
    rows.push(['Período', periodLabel])
    rows.push(['Sucursal', selectedBranch?.name || 'Todas'])
    rows.push([])

    rows.push(['Resumen General'])
    rows.push(['Ingresos', 'Órdenes', 'Ticket promedio', 'Margen bruto', 'Margen %', 'Cobertura costo %'])
    rows.push([
      currentSummary.revenue,
      currentSummary.orders,
      currentSummary.avgTicket,
      currentMargin.grossMargin,
      currentMargin.marginPct.toFixed(2),
      marginCoveragePct.toFixed(2),
    ])
    rows.push([])

    rows.push(['Comparación entre períodos'])
    rows.push([
      'Ingresos actual',
      'Ingresos anterior',
      'Variación %',
      'Órdenes actual',
      'Órdenes anterior',
      'Variación %',
      'Margen actual',
      'Margen anterior',
      'Variación %',
    ])
    rows.push([
      currentSummary.revenue,
      comparisonSummary.prevRevenue,
      comparisonSummary.revenueChange.toFixed(2),
      currentSummary.orders,
      comparisonSummary.prevOrders,
      comparisonSummary.ordersChange.toFixed(2),
      currentMargin.grossMargin,
      comparisonSummary.prevMargin,
      comparisonSummary.marginChange.toFixed(2),
    ])
    rows.push([])

    rows.push(['Ventas por método de pago'])
    rows.push(['Método', 'Monto'])
    paymentMethodSales.forEach((row) => rows.push([row.label, row.amount]))
    rows.push([])

    rows.push(['Resumen por sucursal'])
    rows.push(['Sucursal', 'Órdenes', 'Ingresos'])
    branchSummary.forEach((row) => rows.push([row.branch_name, row.orders, row.revenue]))
    rows.push([])

    rows.push(['Ventas diarias'])
    rows.push(['Fecha', 'Órdenes', 'Ingresos'])
    dailySales.forEach((row) => rows.push([row.date, row.orders, row.revenue]))
    rows.push([])

    rows.push(['Ventas mensuales (últimos 12 meses)'])
    rows.push(['Mes', 'Órdenes', 'Ingresos'])
    monthlySales.forEach((row) => rows.push([row.month, row.orders, row.revenue]))

    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateStamp = toDateKey(new Date()).replace(/-/g, '')
    a.href = url
    a.download = `reporte_ventas_${dateStamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleApplyFilters = () => {
    if (invalidDraftCustomRange) return
    setSelectedBranchId(draftSelectedBranchId)
    setPeriodMode(draftPeriodMode)
    setSelectedMonth(draftSelectedMonth)
    setCustomStart(draftCustomStart)
    setCustomEnd(draftCustomEnd)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes de Ventas</h1>
          <p className="text-gray-600 mt-1">Ventas, márgenes, comparación, método de pago y resumen por sucursal.</p>
        </div>
        <Button onClick={handleExport} className="gap-2" variant="outline">
          <Download className="h-4 w-4" />
          Exportar Excel (CSV)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Filtros del reporte</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Modo período</label>
              <select
                value={draftPeriodMode}
                onChange={(e) => setDraftPeriodMode(e.target.value as PeriodMode)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                <option value="month">Mensual</option>
                <option value="custom">Rango personalizado</option>
              </select>
            </div>

            {draftPeriodMode === 'month' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
                <Input
                  type="month"
                  value={draftSelectedMonth}
                  onChange={(e) => setDraftSelectedMonth(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha inicio</label>
                  <Input
                    type="date"
                    value={draftCustomStart}
                    onChange={(e) => setDraftCustomStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha fin</label>
                  <Input
                    type="date"
                    value={draftCustomEnd}
                    onChange={(e) => setDraftCustomEnd(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sucursal</label>
              <select
                value={draftSelectedBranchId}
                onChange={(e) => setDraftSelectedBranchId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-500"
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

          {invalidDraftCustomRange && (
            <p className="mt-3 text-sm text-red-600">La fecha inicio no puede ser mayor que la fecha fin.</p>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleApplyFilters}
              disabled={invalidDraftCustomRange || !hasPendingFilterChanges || loading}
            >
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ingresos del período</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(currentSummary.revenue, settings)}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Órdenes del período</p>
                <p className="text-2xl font-bold text-gray-900">{currentSummary.orders}</p>
              </div>
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ticket promedio</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(currentSummary.avgTicket, settings)}</p>
              </div>
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Margen bruto (costo trazado)</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(currentMargin.grossMargin, settings)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {currentMargin.marginPct.toFixed(2)}% · Cobertura {marginCoveragePct.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparación entre períodos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Ingresos</p>
              <div className="mt-2 flex items-center gap-2">
                {comparisonSummary.revenueChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <p className={`text-sm font-semibold ${comparisonSummary.revenueChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {comparisonSummary.revenueChange >= 0 ? '+' : ''}{comparisonSummary.revenueChange.toFixed(2)}%
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Actual: {formatPrice(currentSummary.revenue, settings)} | Anterior: {formatPrice(comparisonSummary.prevRevenue, settings)}
              </p>
            </div>

            <div className="p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Órdenes</p>
              <div className="mt-2 flex items-center gap-2">
                {comparisonSummary.ordersChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <p className={`text-sm font-semibold ${comparisonSummary.ordersChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {comparisonSummary.ordersChange >= 0 ? '+' : ''}{comparisonSummary.ordersChange.toFixed(2)}%
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Actual: {currentSummary.orders} | Anterior: {comparisonSummary.prevOrders}
              </p>
            </div>

            <div className="p-4 rounded-lg border border-gray-200 md:col-span-2">
              <p className="text-sm text-gray-500">Margen bruto (costo trazado)</p>
              <div className="mt-2 flex items-center gap-2">
                {comparisonSummary.marginChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <p className={`text-sm font-semibold ${comparisonSummary.marginChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {comparisonSummary.marginChange >= 0 ? '+' : ''}{comparisonSummary.marginChange.toFixed(2)}%
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Actual: {formatPrice(currentMargin.grossMargin, settings)} | Anterior: {formatPrice(comparisonSummary.prevMargin, settings)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Cobertura actual: {currentMargin.trackedItems} de {currentMargin.totalItems} items con costo trazado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {currentMargin.missingItems > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-900">Advertencia de cobertura de costo</p>
            <p className="mt-1 text-sm text-amber-800">
              Hay {currentMargin.missingItems} items de venta sin costo trazado en el período seleccionado.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-amber-900 md:grid-cols-3">
              <div>Sin sucursal en orden: {currentMargin.branchMissingItems}</div>
              <div>Sin costo de inventario: {currentMargin.inventoryCostMissingItems}</div>
              <div>Otros casos: {currentMargin.otherMissingItems}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por método de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethodSales.length === 0 ? (
              <p className="text-sm text-gray-500">No hay datos de pagos para el período seleccionado.</p>
            ) : (
              <div className="space-y-3">
                {paymentMethodSales.map((row) => (
                  <div key={row.method} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">{row.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(row.amount, settings)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span>Resumen general y por sucursal</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {branchSummary.length === 0 ? (
              <p className="text-sm text-gray-500">No hay ventas registradas para mostrar por sucursal.</p>
            ) : (
              <div className="space-y-3">
                {branchSummary.map((row) => (
                  <div key={row.branch_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{row.branch_name}</p>
                      <p className="text-xs text-gray-500">{row.orders} órdenes</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(row.revenue, settings)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas diarias</CardTitle>
        </CardHeader>
        <CardContent>
          {dailySales.length === 0 ? (
            <p className="text-sm text-gray-500">No hay datos diarios para el período seleccionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Órdenes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailySales.map((row) => (
                    <tr key={row.date}>
                      <td className="px-4 py-2 text-sm text-gray-700">{formatDateShort(row.date, settings)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.orders}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatPrice(row.revenue, settings)}</td>
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
          <CardTitle>Ventas mensuales (últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlySales.length === 0 ? (
            <p className="text-sm text-gray-500">No hay datos mensuales para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Órdenes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlySales.map((row) => (
                    <tr key={row.month}>
                      <td className="px-4 py-2 text-sm text-gray-700 capitalize">{monthLabel(row.month)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.orders}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatPrice(row.revenue, settings)}</td>
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
