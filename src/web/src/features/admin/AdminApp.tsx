import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { ErrorState } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import { AdminLayout } from './AdminLayout'
import { adminKeys, meQuery, setUnauthorizedHandler } from './adminApi'
import { PackageEditPage } from './catalog/PackageEditPage'
import { PackagesListPage } from './catalog/PackagesListPage'
import { ProductEditPage } from './catalog/ProductEditPage'
import { ProductsListPage } from './catalog/ProductsListPage'
import { DashboardPage } from './DashboardPage'
import { CitiesPage } from './directory/CitiesPage'
import { DistributorEditPage } from './directory/DistributorEditPage'
import { DistributorsListPage } from './directory/DistributorsListPage'
import { LoginPage } from './LoginPage'

/**
 * The admin area, loaded as its own bundle only when someone opens /admin. Every page is also
 * protected on the server; the checks here only decide what to show.
 */
export default function AdminApp() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Keep admin pages out of search engines.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)

    // Any 401 (expired session, signed out elsewhere): re-check /me, which answers 401 too, and
    // RequireAdmin sends the user to the login page. Login clears the rest of the admin cache.
    setUnauthorizedHandler(() => void queryClient.resetQueries({ queryKey: adminKeys.me }))
    return () => {
      meta.remove()
      setUnauthorizedHandler(null)
    }
  }, [queryClient])

  return (
    <div className="min-h-dvh bg-stone-100 font-sans text-stone-900" dir="rtl">
      <Routes>
        <Route element={<LoginPage />} path="login" />
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route element={<DashboardPage />} index />
          <Route element={<ProductsListPage />} path="products" />
          <Route element={<ProductEditPage />} path="products/new" />
          <Route element={<ProductEditPage />} path="products/:id" />
          <Route element={<PackagesListPage />} path="packages" />
          <Route element={<PackageEditPage />} path="packages/new" />
          <Route element={<PackageEditPage />} path="packages/:id" />
          <Route element={<DistributorsListPage />} path="distributors" />
          <Route element={<DistributorEditPage />} path="distributors/new" />
          <Route element={<DistributorEditPage />} path="distributors/:id" />
          <Route element={<CitiesPage />} path="cities" />
          <Route element={<AdminNotFound />} path="*" />
        </Route>
      </Routes>
    </div>
  )
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useQuery(meQuery)
  const location = useLocation()

  if (me.isPending) {
    return <div aria-busy="true" className="grid min-h-dvh place-items-center text-stone-400" role="status" />
  }
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Navigate replace to={`/admin/login?next=${encodeURIComponent(location.pathname)}`} />
    }
    return (
      <div className="mx-auto max-w-md p-10">
        <ErrorState onRetry={() => void me.refetch()} />
      </div>
    )
  }
  return children
}

function AdminNotFound() {
  const { t } = useTranslation()
  return <p className="rounded-2xl bg-white p-8 text-center font-bold text-stone-600">{t('admin.notFound')}</p>
}
