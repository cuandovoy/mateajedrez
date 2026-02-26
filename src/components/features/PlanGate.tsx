import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

type Props = {
  feature: 'transfers' | 'cash_register' | 'advanced_reports' | 'notifications_config'
  canUse: boolean
  children: React.ReactNode
}

const FEATURE_MESSAGES: Record<string, { title: string; description: string }> = {
  transfers: {
    title: 'Transferencias internas',
    description: 'Las transferencias entre sucursales están disponibles en el plan Profesional.',
  },
  cash_register: {
    title: 'Caja y cierres',
    description: 'El manejo de cajas y cierres está disponible desde el plan Starter.',
  },
  advanced_reports: {
    title: 'Reportes avanzados',
    description: 'Los reportes avanzados están disponibles en el plan Profesional.',
  },
  notifications_config: {
    title: 'Configuración de notificaciones',
    description: 'Las notificaciones por email están disponibles en el plan Profesional.',
  },
}

export function PlanGate({ feature, canUse, children }: Props) {
  if (canUse) return <>{children}</>

  const msg = FEATURE_MESSAGES[feature] ?? {
    title: 'Función no disponible',
    description: 'Esta función está disponible en el plan Profesional.',
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Lock className="h-12 w-12 text-gray-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{msg.title}</h2>
      <p className="text-gray-600 mb-6 max-w-md">{msg.description}</p>
      <Link
        to="/planes"
        className="px-4 py-2 bg-admin-600 text-white rounded-lg hover:bg-admin-700 transition-colors font-medium"
      >
        Ver planes
      </Link>
    </div>
  )
}
