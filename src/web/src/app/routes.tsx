import type { RouteObject } from 'react-router'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { ComingSoonPage } from '@/features/placeholders/ComingSoonPage'
import { RootLayout } from './RootLayout'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ComingSoonPage page="products" /> },
      { path: 'packages', element: <ComingSoonPage page="packages" /> },
      { path: 'distributors', element: <ComingSoonPage page="distributors" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
