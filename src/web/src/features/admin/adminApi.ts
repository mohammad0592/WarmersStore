import { queryOptions } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'

export interface AdminUser {
  email: string
}

export interface Dashboard {
  activeProducts: number
  totalProducts: number
  productsWithoutPrice: number
  activePackages: number
  customPackagesEnabled: boolean
  activeDistributors: number
  pendingOrders: number
  whatsAppConfigured: boolean
  showDistributors: boolean
}

const AUTH_PATHS = new Set(['/api/admin/auth/login', '/api/admin/auth/me'])

/** Called on any 401 so the admin app can send the user back to the login page. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/**
 * Admin API calls: same-origin cookie auth, plus the X-Dafa-Admin header the server requires on
 * state-changing requests (it blocks cross-site request forgery together with SameSite cookies).
 */
export async function adminRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Dafa-Admin': '1',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  // A 401 from login or /me is the expected "not signed in" answer that the pages handle; firing the
  // handler for /me too would clear the cache, refetch /me, get 401 again, and loop.
  if (response.status === 401 && !AUTH_PATHS.has(path)) onUnauthorized?.()
  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => undefined)
    throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`, problem)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export const adminKeys = {
  all: ['admin'] as const,
  me: ['admin', 'me'] as const,
  dashboard: ['admin', 'dashboard'] as const,
}

export const meQuery = queryOptions({
  queryKey: adminKeys.me,
  queryFn: () => adminRequest<AdminUser>('GET', '/api/admin/auth/me'),
  retry: false,
  staleTime: 5 * 60_000,
})

export const dashboardQuery = queryOptions({
  queryKey: adminKeys.dashboard,
  queryFn: () => adminRequest<Dashboard>('GET', '/api/admin/dashboard'),
  staleTime: 0,
})

/** Only same-app admin paths are allowed as a post-login destination (no open redirects). */
export function safeNext(next: string | null): string {
  return next && /^\/admin(\/[\w\-/]*)?$/.test(next) && !next.startsWith('/admin/login') ? next : '/admin'
}
