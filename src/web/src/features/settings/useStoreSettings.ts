import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { PublicStoreSettings } from '@/lib/api/types'

export const storeSettingsQuery = queryOptions({
  queryKey: ['store-settings'],
  queryFn: ({ signal }) => apiGet<PublicStoreSettings>('/api/store-settings', signal),
  staleTime: 5 * 60_000,
})

/** Store-wide settings. `data` is undefined while loading or on error; callers fall back to defaults. */
export function useStoreSettings() {
  return useQuery(storeSettingsQuery)
}
