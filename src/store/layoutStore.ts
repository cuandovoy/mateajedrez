import { create } from 'zustand'

interface LayoutState {
  // true mientras la barra de compra fija de la ficha de producto está visible;
  // el botón flotante de WhatsApp se corre para no taparla.
  stickyCtaVisible: boolean
  setStickyCtaVisible: (visible: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  stickyCtaVisible: false,
  setStickyCtaVisible: (visible) => set({ stickyCtaVisible: visible }),
}))
