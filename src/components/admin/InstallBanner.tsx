import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function InstallBanner() {
  const { canInstall, isIOS, triggerInstall, dismiss } = useInstallPrompt()

  if (!canInstall && !isIOS) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-[#12192C] text-white rounded-xl shadow-lg px-4 py-3 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
          <img src="/logo3.png" alt="Axios" className="h-6 w-6 object-contain" />
        </div>

        {isIOS ? (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Instalá Axios en tu iPhone</p>
            <p className="text-xs text-white/60 leading-snug mt-1">
              Tocá <Share className="inline h-3 w-3 mx-0.5 -mt-0.5" /> en Safari y luego{' '}
              <strong className="text-white/80">"Añadir a pantalla de inicio"</strong>
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Instalar Axios</p>
              <p className="text-xs text-white/60 leading-tight mt-0.5">Acceso rápido desde tu dispositivo</p>
            </div>
            <button
              onClick={triggerInstall}
              className="shrink-0 flex items-center gap-1.5 bg-admin-500 hover:bg-admin-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar
            </button>
          </>
        )}

        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
