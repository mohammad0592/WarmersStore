import { queryOptions } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { Product, ReadyMadePackage } from '@/lib/api/types'

export const productsQuery = queryOptions({
  queryKey: ['products'],
  queryFn: ({ signal }) => apiGet<Product[]>('/api/products', signal),
})

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ['products', slug],
    queryFn: ({ signal }) => apiGet<Product>(`/api/products/${encodeURIComponent(slug)}`, signal),
  })

export const packagesQuery = queryOptions({
  queryKey: ['packages'],
  queryFn: ({ signal }) => apiGet<ReadyMadePackage[]>('/api/packages', signal),
})
