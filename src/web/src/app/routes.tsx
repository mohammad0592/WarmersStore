import type { RouteObject } from 'react-router'
import { ProductDetailsPage } from '@/features/catalog/ProductDetailsPage'
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
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:slug', element: <ProductDetailsPage /> },
      { path: 'packages', element: <PackagesPage /> },
      { path: 'distributors', element: <DistributorsPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'checkout/sent', element: <CheckoutSentPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
