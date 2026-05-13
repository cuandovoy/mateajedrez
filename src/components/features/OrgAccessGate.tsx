import { useOrgAccess } from '@/hooks/useOrgAccess'
import { useOrganizationStore } from '@/store/organizationStore'
import { useAuthStore } from '@/store/authStore'
import { AlertTriangle, Building2, Clock, MessageCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_SALES_NUMBER

interface Props {
  children: React.ReactNode
}

export function OrgAccessGate({ children }: Props) {
  const access = useOrgAccess()
  const org = useOrganizationStore((s) => s.currentOrganization)

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isAdmin = useAuthStore((s) => s.isAdmin)

  // ── Bloqueada: modal overlay sobre el contenido ───────────────────────────
  // Admins siempre pueden entrar. /organizations queda libre para cambiar de org.
  const isBlocked = access.status === 'blocked' && !isAdmin && !pathname.startsWith('/organizations')
  const isPendingDeletion = !!org?.deleted_at && !pathname.startsWith('/organizations')
  const wasTrialing = org?.subscription_status === 'trialing'
  const tierLabel = org?.subscription_tier === 'profesional' ? 'Profesional' : 'Starter'
  const message = encodeURIComponent(
    `Hola! Quisiera abonar la cuota del plan ${tierLabel} de mi tienda *${org?.name ?? ''}*.`
  )

  // ── Banner de trial ───────────────────────────────────────────────────────
  const showTrialBanner = access.status === 'trialing'
  const showExpiryWarning = access.status === 'active' && access.daysLeft <= 5

  return (
    <>
      {showTrialBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Período de prueba:{' '}
              <strong>
                {access.daysLeft} día{access.daysLeft !== 1 ? 's' : ''} restante
                {access.daysLeft !== 1 ? 's' : ''}
              </strong>
              . Contactanos para activar tu suscripción.
            </span>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 underline whitespace-nowrap font-medium hover:text-amber-900"
          >
            Activar ahora
          </a>
        </div>
      )}

      {showExpiryWarning && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Tu suscripción vence en{' '}
              <strong>
                {access.daysLeft} día{access.daysLeft !== 1 ? 's' : ''}
              </strong>
              . Renová antes de que se bloquee el acceso.
            </span>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-700 underline whitespace-nowrap font-medium hover:text-orange-900"
          >
            Renovar
          </a>
        </div>
      )}

      {children}

      {/* Modal de bloqueo por organización pendiente de eliminación */}
      {isPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative max-w-sm w-full bg-white rounded-2xl shadow-2xl p-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                <Clock className="h-7 w-7 text-red-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">
                Organización pendiente de eliminación
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                <strong className="text-gray-900">{org?.name}</strong> está marcada para ser eliminada y ya no es accesible.
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Si querés recuperarla, un administrador puede restaurarla desde la página de Organizaciones.
              </p>
            </div>
            <button
              onClick={() => navigate('/organizations')}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-admin-600 hover:bg-admin-700 text-white text-sm font-medium transition-colors"
            >
              <Building2 className="h-4 w-4" />
              Ver mis organizaciones
            </button>
          </div>
        </div>
      )}

      {/* Modal de bloqueo por suscripción vencida */}
      {isBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop semitransparente — no cierra al clickear */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div className="relative max-w-sm w-full bg-white rounded-2xl shadow-2xl p-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">
                {wasTrialing ? 'Período de prueba finalizado' : 'Suscripción vencida'}
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                {wasTrialing
                  ? 'Los 10 días de prueba gratuita han finalizado.'
                  : 'Tu suscripción está vencida.'}
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Para continuar usando el panel, abonà la cuota del plan{' '}
                <strong className="text-gray-900">{tierLabel}</strong> y contactanos
                para activar tu acceso.
              </p>
            </div>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Abonar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  )
}
