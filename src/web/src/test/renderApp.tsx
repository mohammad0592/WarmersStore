import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/routes'
import { storeSettingsQuery } from '@/features/settings/useStoreSettings'
import type { PublicStoreSettings } from '@/lib/api/types'

export const defaultSettings: PublicStoreSettings = {
  storeName: 'دفا',
  logoUrl: null,
  whatsAppNumber: null,
  phone: null,
  email: null,
  address: null,
  social: { facebook: null, instagram: null, tikTok: null },
  announcement: null,
  minOrderTotal: null,
  showDistributors: false,
  homepage: { heroTitle: null, heroDescription: null, whereToFindText: null },
}

/** Renders the real route tree at `path`, with store settings pre-seeded instead of fetched. */
export function renderApp(path: string, settings: Partial<PublicStoreSettings> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  queryClient.setQueryData(storeSettingsQuery.queryKey, { ...defaultSettings, ...settings })

  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}
