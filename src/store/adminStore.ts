import { create } from 'zustand'

interface AdminState {
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (value: boolean) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),
}))
