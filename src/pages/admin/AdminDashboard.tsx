import { DashboardMetrics } from '@/components/admin/DashboardMetrics'

export function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Métricas del Dashboard */}
      <DashboardMetrics />
      
    </div>
  )
}
