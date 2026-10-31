import type { RouteObject } from 'react-router'
import { RootLayout } from './RootLayout'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/errors/NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
