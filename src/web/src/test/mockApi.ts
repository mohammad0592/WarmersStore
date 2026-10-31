import { vi } from 'vitest'

type MockStatus = { status: number; body?: unknown }
/** A fixed JSON body, a status (+ optional body), or a function of the parsed request body. */
type MockResponse = unknown | MockStatus | ((body: unknown) => unknown)

const isStatus = (value: unknown): value is MockStatus =>
  typeof value === 'object' && value !== null && 'status' in value && typeof (value as { status: unknown }).status === 'number'

/**
 * Stubs `fetch` with JSON responses keyed by path. Unknown paths return 404, so a test fails
 * loudly if a page calls an endpoint it didn't expect. Returns the mock for call checks.
 */
export function mockApi(routes: Record<string, MockResponse>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url
    let route = routes[path]

    if (typeof route === 'function') {
      route = route(init?.body ? JSON.parse(String(init.body)) : undefined)
    }
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
