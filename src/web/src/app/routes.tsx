import type { RouteObject } from 'react-router'
import { ProductDetailsPage } from '@/features/catalog/ProductDetailsPage'
import { ProductsPage } from '@/features/catalog/ProductsPage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { PackagesPage } from '@/features/packages/PackagesPage'
import { ComingSoonPage } from '@/features/placeholders/ComingSoonPage'
import { RootLayout } from './RootLayout'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:slug', element: <ProductDetailsPage /> },
      { path: 'packages', element: <PackagesPage /> },
      { path: 'distributors', element: <ComingSoonPage page="distributors" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
