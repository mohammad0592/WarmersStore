/** Thrown for any non-2xx API response. `body` holds the parsed ProblemDetails/JSON when present. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function parse<T>(response: Response, description: string): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined)
    throw new ApiError(response.status, `${description} failed with ${response.status}`, body)
  }
  return (await response.json()) as T
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' }, signal })
  return parse<T>(response, `GET ${path}`)
}

export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  return parse<T>(response, `POST ${path}`)
}
