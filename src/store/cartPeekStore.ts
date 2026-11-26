import { create } from 'zustand'

export interface CartPeekHighlight {
  productId: string
  variantId: string | null
}

interface CartPeekState {
  // Se incrementa en cada alta exitosa; el CartMenu visible reacciona al cambio.
  token: number
  highlight: CartPeekHighlight | null
  announcement: string
  open: (highlight: CartPeekHighlight, announcement?: string) => void
}

// Estado de UI efímero: abre el mini-carrito del header después de agregar un
// producto. Vive aparte de cartStore para no mezclar datos con presentación.
export const useCartPeekStore = create<CartPeekState>((set, get) => ({
  token: 0,
  highlight: null,
  announcement: '',
  open: (highlight, announcement = 'Agregado al carrito') =>
    set({ token: get().token + 1, highlight, announcement }),
}))
