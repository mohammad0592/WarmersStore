import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiPost } from '@/lib/api/client'
import type { Quote } from '@/lib/api/types'
import { toCartRequest, useCart } from './cartStore'

/**
 * The server's pricing of the current cart. Re-runs whenever lines or quantities change; the
 * previous quote stays on screen meanwhile so totals don't flash.
 */
export function useCartQuote() {
  const lines = useCart((state) => state.lines)
  const request = toCartRequest(lines)

  return useQuery({
    queryKey: ['quote', request],
    queryFn: ({ signal }) => apiPost<Quote>('/api/checkout/quote', { lines: request, deliveryAreaId: null }, signal),
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
