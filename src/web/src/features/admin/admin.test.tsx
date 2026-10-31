import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'
import { safeNext, type Dashboard } from './adminApi'

// The admin area is a lazy chunk; load it once up front so the first test isn't timing a cold import.
beforeAll(async () => {
  await import('./AdminApp')
})

const dashboard: Dashboard = {
  activeProducts: 1,
  totalProducts: 4,
  productsWithoutPrice: 3,
  activePackages: 0,
  customPackagesEnabled: true,
  activeDistributors: 0,
  pendingOrders: 2,
  whatsAppConfigured: false,
  showDistributors: false,
}

function signedIn(overrides: Record<string, unknown> = {}) {
  return mockApi({
    '/api/admin/auth/me': { email: 'admin@test.local' },
    '/api/admin/dashboard': dashboard,
    '/api/admin/auth/logout': { status: 204 },
    ...overrides,
  })
}

describe('admin access', () => {
  it('sends signed-out visitors to the login page, remembering where they were going', async () => {
    mockApi({ '/api/admin/auth/me': { status: 401 } })
    const { router } = renderApp('/admin')

    expect(await screen.findByRole('heading', { name: 'تسجيل دخول الإدارة' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(router.state.location.search).toBe('?next=%2Fadmin')
  })

  it('signs in with the CSRF header and lands on the dashboard', async () => {
    let signedInYet = false
    const fetchMock = mockApi({
      '/api/admin/auth/me': () => (signedInYet ? { email: 'admin@test.local' } : { status: 401 }),
      '/api/admin/auth/login': () => {
        signedInYet = true
        return { email: 'admin@test.local' }
      },
      '/api/admin/dashboard': dashboard,
    })
    renderApp('/admin/login')

    fireEvent.change(await screen.findByLabelText('البريد الإلكتروني'), { target: { value: ' admin@test.local ' } })
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'test-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'دخول' }))

    expect(await screen.findByRole('heading', { name: 'لوحة التحكم' })).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/admin/auth/login')!
    expect((init!.headers as Record<string, string>)['X-Dafa-Admin']).toBe('1')
    expect(JSON.parse(String(init!.body))).toEqual({ email: 'admin@test.local', password: 'test-password-123' })
  })

  it('shows one generic message for a failed sign-in', async () => {
    mockApi({ '/api/admin/auth/me': { status: 401 }, '/api/admin/auth/login': { status: 401 } })
    renderApp('/admin/login')

    fireEvent.change(await screen.findByLabelText('البريد الإلكتروني'), { target: { value: 'admin@test.local' } })
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'دخول' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
  })

  it('requires both fields before calling the server', async () => {
    const fetchMock = mockApi({ '/api/admin/auth/me': { status: 401 } })
    renderApp('/admin/login')

    fireEvent.click(await screen.findByRole('button', { name: 'دخول' }))

    expect(screen.getAllByText('هذا الحقل مطلوب.')).toHaveLength(2)
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/admin/auth/login')).toBe(false)
  })

  it('returns to the login page when the session expires mid-use', async () => {
    // /me still answers from before; the session ends just as the dashboard loads.
    let expired = false
    mockApi({
      '/api/admin/auth/me': () => (expired ? { status: 401 } : { email: 'admin@test.local' }),
      '/api/admin/dashboard': () => {
        expired = true
        return { status: 401 }
      },
    })
    const { router } = renderApp('/admin')

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'))
    expect(await screen.findByRole('heading', { name: 'تسجيل دخول الإدارة' })).toBeInTheDocument()
  })

  it('logs out and returns to the login page', async () => {
    const fetchMock = signedIn()
    const { router } = renderApp('/admin')

    fireEvent.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/login'))
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/admin/auth/logout' && init?.method === 'POST')).toBe(true)
  })

  it('keeps the storefront header and footer out of the admin area', async () => {
    signedIn()
    renderApp('/admin')

    await screen.findByRole('heading', { name: 'لوحة التحكم' })
    expect(screen.queryByRole('button', { name: /فتح سلة المشتريات/ })).toBeNull()
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })
})

describe('dashboard', () => {
  it('shows the counts and a launch checklist', async () => {
    signedIn()
    renderApp('/admin')

    const stats = await screen.findByText('طلبات بانتظار التأكيد')
    expect(within(stats.closest('div')!).getByText('2')).toBeInTheDocument()
    expect(screen.getByText('من أصل 4')).toBeInTheDocument()
    expect(screen.getByText('مفعّلة')).toBeInTheDocument()

    const checklist = screen.getByRole('region', { name: 'قائمة التجهيز قبل الإطلاق' })
    expect(within(checklist).getByText('أضف رقم واتساب المتجر حتى يقدر الزبائن يرسلوا طلباتهم.')).toBeInTheDocument()
    expect(within(checklist).getByText('3 منتجات بدون سعر بعد.')).toBeInTheDocument()
    expect(within(checklist).queryByText('فعّل المنتجات بعد إضافة الأسعار والصور.')).toBeNull() // one is active
  })
})

describe('safeNext', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/products', '/admin/products'],
    [null, '/admin'],
    ['https://evil.example', '/admin'],
    ['//evil.example/admin', '/admin'],
    ['/admin/login', '/admin'],
    ['/products', '/admin'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
