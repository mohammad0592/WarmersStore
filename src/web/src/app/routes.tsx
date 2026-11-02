import type { RouteObject } from 'react-router'
import { ProductDetailsDialog } from '@/features/catalog/ProductDetailsDialog'
import { ProductsPage } from '@/features/catalog/ProductsPage'
import { CheckoutSentPage } from '@/features/checkout/CheckoutSentPage'
import { DistributorsPage } from '@/features/distributors/DistributorsPage'
import { AppErrorPage } from '@/features/errors/AppErrorPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { PackagesPage } from '@/features/packages/PackagesPage'
import { AdminEntry } from './AdminEntry'
import { CheckoutEntry } from './CheckoutEntry'
import { RootLayout } from './RootLayout'

export const routes: RouteObject[] = [
  {
    path: 'admin/*',
    element: <AdminEntry />,
    errorElement: <AppErrorPage />,
  },
  {
    element: <RootLayout />,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      // Details open as a dialog over the catalog, so a product link still lands on the list.
      { path: 'products', element: <ProductsPage />, children: [{ path: ':slug', element: <ProductDetailsDialog /> }] },
      { path: 'packages', element: <PackagesPage /> },
      { path: 'distributors', element: <DistributorsPage /> },
      { path: 'checkout', element: <CheckoutEntry /> },
      { path: 'checkout/sent', element: <CheckoutSentPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
