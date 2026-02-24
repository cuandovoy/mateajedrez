import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Users2 } from 'lucide-react'

export function AdminCustomerReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reporte de Clientes</h1>
        <p className="text-gray-600 mt-1">Vista en preparación para análisis de clientes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            <span>Próximamente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Aquí vas a poder trabajar métricas como recurrencia, ticket promedio por cliente,
            clientes nuevos vs. recurrentes y segmentación por período.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
