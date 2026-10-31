import type { RouteObject } from 'react-router'
import { ProductDetailsDialog } from '@/features/catalog/ProductDetailsDialog'
import { ProductsPage } from '@/features/catalog/ProductsPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { CheckoutSentPage } from '@/features/checkout/CheckoutSentPage'
import { DistributorsPage } from '@/features/distributors/DistributorsPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { PackagesPage } from '@/features/packages/PackagesPage'
import { AdminEntry } from './AdminEntry'
import { RootLayout } from './RootLayout'

export const routes: RouteObject[] = [
  {
    path: 'admin/*',
    element: <AdminEntry />,
  },
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      // Details open as a dialog over the catalog, so a product link still lands on the list.
      { path: 'products', element: <ProductsPage />, children: [{ path: ':slug', element: <ProductDetailsDialog /> }] },
      { path: 'packages', element: <PackagesPage /> },
      { path: 'distributors', element: <DistributorsPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'checkout/sent', element: <CheckoutSentPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
