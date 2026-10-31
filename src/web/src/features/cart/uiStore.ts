import { create } from 'zustand'

interface CartUiState {
  cartOpen: boolean
  toast: { id: number; message: string } | null
  openCart: () => void
  closeCart: () => void
  showToast: (message: string) => void
  dismissToast: () => void
}

/** Transient UI state shared by the header, cards and drawer. Not persisted. */
export const useCartUi = create<CartUiState>()((set) => ({
  cartOpen: false,
  toast: null,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  showToast: (message) => set({ toast: { id: Date.now(), message } }),
  dismissToast: () => set({ toast: null }),
}))
