import { queryOptions } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { DeliveryOptions } from '@/lib/api/types'

export const deliveryOptionsQuery = queryOptions({
  queryKey: ['delivery-options'],
  queryFn: ({ signal }) => apiGet<DeliveryOptions>('/api/delivery-options', signal),
})
