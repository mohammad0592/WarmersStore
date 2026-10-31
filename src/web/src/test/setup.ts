import '@testing-library/jest-dom/vitest'
import '@/i18n'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { useCart } from '@/features/cart/cartStore'
import { useCartUi } from '@/features/cart/uiStore'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  useCart.setState({ lines: [] })
  useCartUi.setState({ cartOpen: false, toast: null })
})
