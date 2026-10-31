import { queryOptions } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { City, Distributor } from '@/lib/api/types'

export const citiesQuery = queryOptions({
  queryKey: ['cities'],
  queryFn: ({ signal }) => apiGet<City[]>('/api/cities', signal),
})

/** All visible distributors, already ordered by city then display order. Filtered by city on the client. */
export const distributorsQuery = queryOptions({
  queryKey: ['distributors'],
  queryFn: ({ signal }) => apiGet<Distributor[]>('/api/distributors', signal),
})
