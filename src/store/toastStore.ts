import { create } from 'zustand'
import type { ToastType } from '@/components/ui/Toast'

interface ToastState {
  message: string | null
  type: ToastType
  id: number
  show: (message: string, type?: ToastType) => void
  hide: () => void
}

// Id incremental para que ToastContainer pueda remontar <Toast> con un `key`
// distinto en cada `show()` — incluso cuando dos toasts seguidos tienen el
// mismo texto — y así cada uno arranque su propio timer de auto-cierre.
let toastIdCounter = 0

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'success',
  id: 0,
  show: (message: string, type: ToastType = 'success') => {
    toastIdCounter += 1
    set({ message, type, id: toastIdCounter })
  },
  hide: () => {
    set({ message: null })
  },
}))
