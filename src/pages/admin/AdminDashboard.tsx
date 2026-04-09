import { DashboardMetrics } from '@/components/admin/DashboardMetrics'

export function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600 mt-2">Gestiona tu tienda desde aquí</p>
      </div>

      {/* Métricas del Dashboard */}
      <DashboardMetrics />
      
    </div>
  )
}
