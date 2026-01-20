import { create } from 'zustand'
import type { ToastType } from '@/components/ui/Toast'

interface ToastState {
  message: string | null
  type: ToastType
  show: (message: string, type?: ToastType) => void
  hide: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'success',
  show: (message: string, type: ToastType = 'success') => {
    set({ message, type })
  },
  hide: () => {
    set({ message: null })
  },
}))
