import { queryOptions } from '@tanstack/react-query'
import { apiGet } from '@/lib/api/client'
import type { CustomPackageRules } from '@/lib/api/types'

export const customRulesQuery = queryOptions({
  queryKey: ['custom-package-rules'],
  queryFn: ({ signal }) => apiGet<CustomPackageRules>('/api/custom-package-rules', signal),
})
