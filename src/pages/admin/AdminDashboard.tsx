import { DashboardMetrics } from '@/components/admin/DashboardMetrics'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'
import { WelcomeModal } from '@/components/admin/WelcomeModal'

export function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      <WelcomeModal />
      <OnboardingChecklist />
      <DashboardMetrics />
    </div>
  )
}
