import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useAdminBranches } from '@/hooks/useAdminBranches'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { formatPrice } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import { useQuery } from '@tanstack/react-query'
import { Download, Warehouse } from 'lucide-react'
import { useState } from 'react'

type ValuationRow = {
  product_id: string
  product_name: string
  sku: string | null
  variant_id: string | null
  variant_name: string | null
  branch_id: string
  branch_name: string
  stock: number
  avg_unit_cost: number
  total_value: number
}

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function AdminInventoryReports() {
  const { organizationId } = useOrganization()
  const settings = useOrgSettings()
  const { show } = useToastStore()
  const [exporting, setExporting] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState('')

  const { data: branches = [] } = useAdminBranches(organizationId)

  const { data: rows = [], isPending: loading, refetch: fetchValuation } = useQuery({
    queryKey: queryKeys.reports.inventory(organizationId!, { selectedBranchId }),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_inventory_valuation_report', {
        p_organization_id: organizationId,
        p_branch_id: selectedBranchId || null,
      })
      if (error) throw error
      return (data || []) as ValuationRow[]
    },
    enabled: !!organizationId,
    staleTime: 3 * 60 * 1000,
  })

  const totalValue = rows.reduce((acc, row) => acc + row.total_value, 0)
  const totalUnits = rows.reduce((acc, row) => acc + row.stock, 0)

  const exportCsv = async () => {
    try {
      setExporting(true)
      const header = ['Producto', 'SKU', 'Variante', 'Sucursal', 'Stock', 'Costo unitario', 'Valor total']
      const csvRows = rows.map((row) => [
        row.product_name,
        row.sku ?? '',
        row.variant_name ?? '',
        row.branch_name,
        row.stock,
        row.avg_unit_cost,
        row.total_value,
      ])
      const csv = [header, ...csvRows].map((row) => row.map(escapeCsv).join(',')).join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.href = url
      a.download = `valuacion_inventario_${dateStamp}.csv`
      a.click()
      URL.revokeObjectURL(url)
      show(`Exportación completada (${rows.length} filas).`, 'success')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al exportar'
      show(msg, 'error')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-admin-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reporte de Inventario</h1>
        <p className="mt-1 text-gray-600">Valuación del stock actual por producto y sucursal.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => fetchValuation()} disabled={loading}>
            Actualizar
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || rows.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Valor total del stock</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(totalValue, settings)}</p>
            <p className="text-xs text-gray-500">Costo promedio ponderado × unidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total de unidades</p>
            <p className="text-2xl font-bold text-gray-900">{totalUnits.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Unidades en stock con costo registrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Productos valuados</p>
            <p className="text-2xl font-bold text-gray-900">{rows.length.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Registros con stock y costo mayor a 0</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            <span>Valuación por producto</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No hay productos con stock y costo registrado para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">SKU</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Sucursal</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Stock</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Costo unit.</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Valor total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={`${row.product_id}-${row.variant_id ?? 'base'}-${row.branch_id}-${i}`}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {row.product_name}
                        {row.variant_name && (
                          <span className="ml-1 text-xs text-gray-500">— {row.variant_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{row.sku ?? '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{row.branch_name}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">{row.stock}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900">
                        {formatPrice(row.avg_unit_cost, settings)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                        {formatPrice(row.total_value, settings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-700">
                      Total
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">{totalUnits}</td>
                    <td />
                    <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">
                      {formatPrice(totalValue, settings)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
