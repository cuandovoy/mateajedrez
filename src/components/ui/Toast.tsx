import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
  action?: { label: string; onClick: () => void }
}

export function Toast({ message, type = 'success', onClose, duration = 3000, action }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [onClose, duration])

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }

  const iconStyles = {
    success: 'text-[#46602B] bg-[#EEF3E6]',
    error: 'text-red-700 bg-red-50',
    info: 'text-brand-cuero bg-brand-crema',
  }

  const Icon = icons[type]

  return (
    <div
      role="alert"
      className="animate-fade-in-up fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-md border border-brand-line bg-white text-brand-tinta shadow-[0_8px_24px_-12px_rgba(43,36,24,0.35)]"
    >
      <span className={cn('flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0', iconStyles[type])}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium flex-1 min-w-0">{message}</p>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            onClose()
          }}
          className="min-h-[44px] px-2 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-brand-cuero hover:text-brand-cuero-oscuro underline underline-offset-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cuero rounded"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-brand-muted hover:text-brand-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 rounded"
        aria-label="Cerrar notificación"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
