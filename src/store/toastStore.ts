import { create } from 'zustand'
import type { ToastType } from '@/components/ui/Toast'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
  duration?: number
}

interface ToastState {
  message: string | null
  type: ToastType
  id: number
  action: ToastAction | null
  duration: number | null
  show: (message: string, type?: ToastType, options?: ToastOptions) => void
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
  action: null,
  duration: null,
  show: (message: string, type: ToastType = 'success', options?: ToastOptions) => {
    toastIdCounter += 1
    set({
      message,
      type,
      id: toastIdCounter,
      action: options?.action ?? null,
      duration: options?.duration ?? null,
    })
  },
  hide: () => {
    set({ message: null, action: null, duration: null })
  },
}))
