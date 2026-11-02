import { lazy, Suspense } from 'react'

// Separate bundle: the form libraries load only when a customer reaches checkout.
const CheckoutPage = lazy(() => import('@/features/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))

export function CheckoutEntry() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-96" role="status" />}>
      <CheckoutPage />
    </Suspense>
  )
}
