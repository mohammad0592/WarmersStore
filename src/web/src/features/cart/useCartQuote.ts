import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiPost } from '@/lib/api/client'
import type { Quote } from '@/lib/api/types'
import { toCartRequest, useCart } from './cartStore'

/**
 * The server's pricing of the current cart (optionally for a delivery area). Re-runs whenever
 * lines, quantities or the area change; the previous quote stays on screen meanwhile.
 */
export function useCartQuote(deliveryAreaId: number | null = null) {
  const lines = useCart((state) => state.lines)
  const request = toCartRequest(lines)

  return useQuery({
    queryKey: ['quote', request, deliveryAreaId],
    queryFn: ({ signal }) => apiPost<Quote>('/api/checkout/quote', { lines: request, deliveryAreaId }, signal),
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
