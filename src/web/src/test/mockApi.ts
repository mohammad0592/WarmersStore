import { vi } from 'vitest'

type MockResponse = unknown | { status: number; body?: unknown }

const isStatus = (value: unknown): value is { status: number; body?: unknown } =>
  typeof value === 'object' && value !== null && 'status' in value && typeof (value as { status: unknown }).status === 'number'

/**
 * Stubs `fetch` with fixed JSON responses keyed by path. Unknown paths return 404, so a test
 * fails loudly if a page calls an endpoint it didn't expect. Returns the mock for call checks.
 */
export function mockApi(routes: Record<string, MockResponse>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url
    const route = routes[path]

    if (route === undefined) {
      return new Response(JSON.stringify({ status: 404 }), { status: 404 })
    }
    if (isStatus(route)) {
      return new Response(JSON.stringify(route.body ?? { status: route.status }), { status: route.status })
    }
    return new Response(JSON.stringify(route), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
