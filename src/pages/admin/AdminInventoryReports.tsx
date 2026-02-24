import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Warehouse } from 'lucide-react'

export function AdminInventoryReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reporte de Inventario</h1>
        <p className="text-gray-600 mt-1">Vista en preparación para análisis de inventario.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            <span>Próximamente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Aquí vas a poder trabajar métricas como rotación, cobertura, quiebres de stock,
            productos inmovilizados y valuación por sucursal.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
