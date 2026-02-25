import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { supabase } from '@/lib/supabase'
import { formatDateShort, formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'
import { Calendar, Download, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Summary = {
  salesRevenue: number
  salesOrders: number
  grossMargin: number
  accrualExpense: number
  cashExpense: number
  netCashflow: number
}

type SeriesPoint = {
  label: string
  sales: number
  expenses: number
  net: number
}

type Aging = {
  current: number
  days1To30: number
  days31To60: number
  days61To90: number
  days90Plus: number
  totalOutstanding: number
  openInvoices: number
}

type SupplierOutstanding = {
  supplierId: string
  supplierName: string
  outstandingAmount: number
}

type FinancialExportRow = {
  section: string
  row_key: string
  metric_label: string
  value_1: number | null
  value_2: number | null
  value_3: number | null
  extra: unknown
}

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

export function AdminFinancialReports() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()

  const [loading, setLoading] = useState(true)
  const [refreshingAggregates, setRefreshingAggregates] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return toDateKey(date)
  })
  const [endDate, setEndDate] = useState(() => toDateKey(new Date()))
  const [asOfDate, setAsOfDate] = useState(() => toDateKey(new Date()))

  const [draftBranchId, setDraftBranchId] = useState(selectedBranchId)
  const [draftStartDate, setDraftStartDate] = useState(startDate)
  const [draftEndDate, setDraftEndDate] = useState(endDate)
  const [draftAsOfDate, setDraftAsOfDate] = useState(asOfDate)

  const [summary, setSummary] = useState<Summary>({
    salesRevenue: 0,
    salesOrders: 0,
    grossMargin: 0,
    accrualExpense: 0,
    cashExpense: 0,
    netCashflow: 0,
  })
  const [dailySeries, setDailySeries] = useState<SeriesPoint[]>([])
  const [monthlySeries, setMonthlySeries] = useState<SeriesPoint[]>([])
  const [aging, setAging] = useState<Aging>({
    current: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    days90Plus: 0,
    totalOutstanding: 0,
    openInvoices: 0,
  })
  const [topSuppliers, setTopSuppliers] = useState<SupplierOutstanding[]>([])

  const invalidRange = draftStartDate > draftEndDate
  const hasPendingChanges =
    draftBranchId !== selectedBranchId ||
    draftStartDate !== startDate ||
    draftEndDate !== endDate ||
    draftAsOfDate !== asOfDate

  useEffect(() => {
    if (!organizationId) return
    fetchBranches()
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    fetchFinancialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, selectedBranchId, startDate, endDate, asOfDate])

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

  const fetchFinancialData = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_financial_report_summary', {
        p_organization_id: organizationId,
        p_range_start: `${startDate}T00:00:00`,
        p_range_end: `${endDate}T23:59:59`,
        p_branch_id: selectedBranchId || null,
        p_as_of_date: asOfDate,
      })

      if (error) throw error

      const payload = (data || {}) as Record<string, unknown>
      const summaryPayload = (payload.summary as Record<string, unknown> | undefined) || {}
      const agingPayload = (payload.accounts_payable_aging as Record<string, unknown> | undefined) || {}

      setSummary({
        salesRevenue: asNumber(summaryPayload.sales_revenue),
        salesOrders: asNumber(summaryPayload.sales_orders),
        grossMargin: asNumber(summaryPayload.gross_margin),
        accrualExpense: asNumber(summaryPayload.accrual_expense),
        cashExpense: asNumber(summaryPayload.cash_expense),
        netCashflow: asNumber(summaryPayload.net_cashflow),
      })

      const daily = Array.isArray(payload.daily_sales_vs_expenses) ? payload.daily_sales_vs_expenses : []
      setDailySeries(
        daily.map((item) => {
          const row = item as Record<string, unknown>
          return {
            label: asString(row.date),
            sales: asNumber(row.sales),
            expenses: asNumber(row.expenses),
            net: asNumber(row.net),
          }
        })
      )

      const monthly = Array.isArray(payload.monthly_sales_vs_expenses) ? payload.monthly_sales_vs_expenses : []
      setMonthlySeries(
        monthly.map((item) => {
          const row = item as Record<string, unknown>
          return {
            label: asString(row.month),
            sales: asNumber(row.sales),
            expenses: asNumber(row.expenses),
            net: asNumber(row.net),
          }
        })
      )

      setAging({
        current: asNumber(agingPayload.current),
        days1To30: asNumber(agingPayload.days_1_30),
        days31To60: asNumber(agingPayload.days_31_60),
        days61To90: asNumber(agingPayload.days_61_90),
        days90Plus: asNumber(agingPayload.days_90_plus),
        totalOutstanding: asNumber(agingPayload.total_outstanding),
        openInvoices: asNumber(agingPayload.open_invoices),
      })

      const top = Array.isArray(payload.top_suppliers_outstanding) ? payload.top_suppliers_outstanding : []
      setTopSuppliers(
        top.map((item) => {
          const row = item as Record<string, unknown>
          return {
            supplierId: asString(row.supplier_id),
            supplierName: asString(row.supplier_name) || 'Proveedor',
            outstandingAmount: asNumber(row.outstanding_amount),
          }
        })
      )
    } catch (error) {
      console.error('Error fetching financial report:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    if (invalidRange) return
    setSelectedBranchId(draftBranchId)
    setStartDate(draftStartDate)
    setEndDate(draftEndDate)
    setAsOfDate(draftAsOfDate)
  }

  const refreshAggregates = async () => {
    try {
      setRefreshingAggregates(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('refresh_financial_reporting_materialized_views')
      if (error) throw error
      show('Agregados financieros actualizados.', 'success')
      await fetchFinancialData()
    } catch (error: any) {
      console.error('Error refreshing financial aggregates:', error)
      show(error?.message || 'No se pudieron actualizar los agregados.', 'error')
    } finally {
      setRefreshingAggregates(false)
    }
  }

  const exportFinancialReport = async () => {
    if (!organizationId) return
    const pageSize = 5000
    let offset = 0
    const allRows: FinancialExportRow[] = []

    try {
      setExporting(true)

      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('export_financial_report_rows', {
          p_organization_id: organizationId,
          p_range_start: `${startDate}T00:00:00`,
          p_range_end: `${endDate}T23:59:59`,
          p_branch_id: selectedBranchId || null,
          p_as_of_date: asOfDate,
          p_limit: pageSize,
          p_offset: offset,
        })

        if (error) throw error

        const page = Array.isArray(data) ? (data as FinancialExportRow[]) : []
        allRows.push(...page)

        if (page.length < pageSize) break
        offset += pageSize
      }

      const rows: unknown[][] = []
      rows.push(['Reporte Financiero'])
      rows.push(['Período', `${startDate} a ${endDate}`])
      rows.push(['Sucursal', selectedBranch?.name || 'Todas las sucursales'])
      rows.push(['Fecha de corte de antigüedad', asOfDate])
      rows.push([])
      rows.push(['Resumen general'])
      rows.push(['Ingresos por ventas', 'Egresos de caja', 'Flujo neto', 'Órdenes', 'Margen bruto', 'Egresos devengados'])
      allRows
        .filter((row) => row.section === 'summary')
        .forEach((row) => {
          const extra = asObject(row.extra)
          rows.push([
            row.value_1,
            row.value_2,
            row.value_3,
            asNumber(extra.sales_orders),
            asNumber(extra.gross_margin),
            asNumber(extra.accrual_expense),
          ])
        })
      rows.push([])

      rows.push(['Ventas vs egresos diarios'])
      rows.push(['Fecha', 'Ventas', 'Egresos', 'Neto'])
      allRows
        .filter((row) => row.section === 'daily_sales_vs_expenses')
        .forEach((row) => {
          rows.push([row.row_key, row.value_1, row.value_2, row.value_3])
        })
      rows.push([])

      rows.push(['Ventas vs egresos mensuales'])
      rows.push(['Mes', 'Ventas', 'Egresos', 'Neto'])
      allRows
        .filter((row) => row.section === 'monthly_sales_vs_expenses')
        .forEach((row) => {
          rows.push([row.row_key, row.value_1, row.value_2, row.value_3])
        })
      rows.push([])

      rows.push(['Cuentas por pagar por antigüedad'])
      rows.push(['Tramo', 'Monto'])
      allRows
        .filter((row) => row.section === 'accounts_payable_aging')
        .forEach((row) => {
          rows.push([row.metric_label, row.value_1])
        })
      rows.push([])

      rows.push(['Proveedores con mayor deuda'])
      rows.push(['Proveedor', 'Monto pendiente'])
      allRows
        .filter((row) => row.section === 'top_suppliers_outstanding')
        .forEach((row) => {
          rows.push([row.metric_label, row.value_1])
        })
      rows.push([])

      rows.push(['Facturas abiertas'])
      rows.push(['Proveedor', 'Monto pendiente', 'Días de atraso', 'Número de factura', 'Fecha de vencimiento'])
      allRows
        .filter((row) => row.section === 'accounts_payable_open')
        .forEach((row) => {
          const extra = asObject(row.extra)
          rows.push([
            row.metric_label,
            row.value_1,
            row.value_2,
            asString(extra.invoice_number),
            asString(extra.due_date),
          ])
        })

      const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStamp = toDateKey(new Date()).replace(/-/g, '')
      a.href = url
      a.download = `reporte_financiero_${dateStamp}.csv`
      a.click()
      URL.revokeObjectURL(url)

      show(`Exportación completada (${allRows.length} filas).`, 'success')
    } catch (error: any) {
      console.error('Error exporting financial report:', error)
      show(error?.message || 'No se pudo exportar el reporte.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId),
    [branches, selectedBranchId]
  )

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-admin-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reporte Financiero</h1>
        <p className="mt-1 text-gray-600">Ventas vs egresos, flujo neto y cuentas por pagar.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={exportFinancialReport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </Button>
        <Button variant="outline" onClick={refreshAggregates} disabled={refreshingAggregates}>
          {refreshingAggregates ? 'Actualizando agregados...' : 'Actualizar agregados'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Fecha inicio</label>
              <Input type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Fecha fin</label>
              <Input type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Fecha de corte de antigüedad</label>
              <Input type="date" value={draftAsOfDate} onChange={(event) => setDraftAsOfDate(event.target.value)} />
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

          <div className="mt-4 flex justify-end">
            <Button onClick={applyFilters} disabled={invalidRange || !hasPendingChanges}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Ventas</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.salesRevenue, settings)}</p>
            <p className="text-xs text-gray-500">{summary.salesOrders} órdenes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Egresos caja</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.cashExpense, settings)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Margen bruto</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.grossMargin, settings)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Flujo neto</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.netCashflow, settings)}</p>
                <p className="text-xs text-gray-500">{selectedBranch?.name || 'Todas las sucursales'}</p>
              </div>
              {summary.netCashflow >= 0 ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas vs egresos diarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fecha</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Ventas</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Egresos</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailySeries.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2 text-sm text-gray-700">{formatDateShort(row.label, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">{formatPrice(row.sales, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">{formatPrice(row.expenses, settings)}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(row.net, settings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cuentas por pagar por antigüedad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p>
                <span className="font-medium">Total pendiente:</span> {formatPrice(aging.totalOutstanding, settings)}
              </p>
              <p>
                <span className="font-medium">Facturas abiertas:</span> {aging.openInvoices}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">Corriente: {formatPrice(aging.current, settings)}</div>
              <div className="rounded border p-2">1-30 días: {formatPrice(aging.days1To30, settings)}</div>
              <div className="rounded border p-2">31-60 días: {formatPrice(aging.days31To60, settings)}</div>
              <div className="rounded border p-2">61-90 días: {formatPrice(aging.days61To90, settings)}</div>
              <div className="rounded border p-2 col-span-2">+90 días: {formatPrice(aging.days90Plus, settings)}</div>
            </div>

            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium text-gray-700">Top proveedores con deuda</p>
              <div className="space-y-2">
                {topSuppliers.map((supplier) => (
                  <div key={supplier.supplierId} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
                    <span className="text-gray-700">{supplier.supplierName}</span>
                    <span className="font-semibold text-gray-900">{formatPrice(supplier.outstandingAmount, settings)}</span>
                  </div>
                ))}
                {topSuppliers.length === 0 && <p className="text-sm text-gray-500">No hay saldos pendientes.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <span>Ventas vs egresos mensuales</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Mes</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Ventas</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Egresos</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlySeries.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.label}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900">{formatPrice(row.sales, settings)}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900">{formatPrice(row.expenses, settings)}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{formatPrice(row.net, settings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
