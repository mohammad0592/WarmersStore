import { lazy, Suspense } from 'react'

// Separate bundle: customers never download admin code.
const AdminApp = lazy(() => import('@/features/admin/AdminApp'))

export function AdminEntry() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh bg-stone-100" role="status" />}>
      <AdminApp />
    </Suspense>
  )
}
