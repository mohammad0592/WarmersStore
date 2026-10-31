import { queryOptions } from '@tanstack/react-query'
import { adminRequest } from '../adminApi'

export interface AdminCity {
  id: number
  slug: string
  name: string
  isActive: boolean
  displayOrder: number
  distributorCount: number
  activeDistributorCount: number
}

export interface AdminDistributor {
  id: number
  name: string
  cityId: number
  cityName: string
  address: string
  phoneNumber: string | null
  googleMapsUrl: string | null
  latitude: number | null
  longitude: number | null
  /** The link customers open: from coordinates when set, else the Google Maps URL. */
  mapUrl: string | null
  imageUrl: string | null
  isActive: boolean
  displayOrder: number
  version: number
}

export const directoryKeys = {
  cities: ['admin', 'cities'] as const,
  distributors: ['admin', 'distributors'] as const,
  distributor: (id: number) => ['admin', 'distributors', id] as const,
}

export const adminCitiesQuery = queryOptions({
  queryKey: directoryKeys.cities,
  queryFn: () => adminRequest<AdminCity[]>('GET', '/api/admin/cities'),
})

export const adminDistributorsQuery = queryOptions({
  queryKey: directoryKeys.distributors,
  queryFn: () => adminRequest<AdminDistributor[]>('GET', '/api/admin/distributors'),
})

export const adminDistributorQuery = (id: number) =>
  queryOptions({
    queryKey: directoryKeys.distributor(id),
    queryFn: () => adminRequest<AdminDistributor>('GET', `/api/admin/distributors/${id}`),
  })
