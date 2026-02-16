import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
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

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const Icon = icons[type]

  return (
    <div
      role="alert"
      className={cn(
        'fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border',
        styles[type]
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1 min-w-0">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-current hover:opacity-70 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 rounded"
        aria-label="Cerrar notificación"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
