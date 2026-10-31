import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'
import type { AdminCity, AdminDistributor } from './directoryApi'

beforeAll(async () => {
  await import('../AdminApp')
})

const nablus: AdminCity = { id: 1, slug: 'nablus', name: 'نابلس', isActive: true, displayOrder: 1, distributorCount: 2, activeDistributorCount: 1 }
const hebron: AdminCity = { id: 2, slug: 'hebron', name: 'الخليل', isActive: true, displayOrder: 2, distributorCount: 0, activeDistributorCount: 0 }

const shop = (overrides: Partial<AdminDistributor> = {}): AdminDistributor => ({
  id: 10, name: 'محل الدفا', cityId: 1, cityName: 'نابلس', address: 'شارع فيصل', phoneNumber: '+970599123456',
  googleMapsUrl: 'https://maps.app.goo.gl/AbC', latitude: null, longitude: null, mapUrl: 'https://maps.app.goo.gl/AbC',
  imageUrl: null, isActive: true, displayOrder: 1, version: 3, ...overrides,
})

type Call = [RequestInfo | URL, (RequestInit | undefined)?]
const callsTo = (fetchMock: { mock: { calls: Call[] } }, url: string, method: string) =>
  fetchMock.mock.calls.filter(([u, init]) => u === url && (init?.method ?? 'GET') === method)
const bodyOf = (call: Call) => JSON.parse(String(call[1]!.body))

function admin(routes: Record<string, unknown>) {
  return mockApi({ '/api/admin/auth/me': { email: 'admin@test.local' }, '/api/admin/dashboard': {}, ...routes })
}

describe('admin cities', () => {
  it('adds a city', async () => {
    const fetchMock = admin({ '/api/admin/cities': (body: unknown) => (body ? { ...hebron } : [nablus]) })
    renderApp('/admin/cities')

    expect(await screen.findByText('نابلس')).toBeInTheDocument()
    expect(screen.getByText(/2 موزعين · 1 فعّال/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/اسم المدينة/), { target: { value: 'الخليل' } })
    fireEvent.change(screen.getByLabelText(/المعرّف في الرابط/), { target: { value: 'hebron' } })
    fireEvent.click(screen.getByRole('button', { name: /إضافة مدينة/ }))

    await waitFor(() => expect(callsTo(fetchMock, '/api/admin/cities', 'POST')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/admin/cities', 'POST')[0])).toEqual({ name: 'الخليل', slug: 'hebron', isActive: true })
  })

  it('explains why a city with distributors cannot be deleted', async () => {
    admin({
      '/api/admin/cities': [nablus],
      '/api/admin/cities/1': { status: 409, body: { detail: 'في هذه المدينة 2 موزعين. انقلهم لمدينة أخرى أو احذفهم أولاً، أو أوقف المدينة بدلاً من حذفها.' } },
    })
    renderApp('/admin/cities')

    fireEvent.click(await screen.findByRole('button', { name: 'حذف نابلس' }))
    const dialog = screen.getByRole('alertdialog', { name: 'حذف المدينة؟' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف' }))

    expect(await within(dialog).findByText(/في هذه المدينة 2 موزعين/)).toBeInTheDocument()
  })
})

describe('admin distributors', () => {
  it('filters by city and status and flags shops without a location', async () => {
    admin({
      '/api/admin/cities': [nablus, hebron],
      '/api/admin/distributors': [
        shop(),
        shop({ id: 11, name: 'محل بدون موقع', isActive: false, googleMapsUrl: null, mapUrl: null }),
        shop({ id: 12, name: 'محل الخليل', cityId: 2, cityName: 'الخليل' }),
      ],
    })
    renderApp('/admin/distributors')

    expect(await screen.findByRole('link', { name: 'محل الخليل' })).toBeInTheDocument()
    expect(screen.getByText('بدون موقع')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('تصفية حسب المدينة'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('تصفية حسب الحالة'), { target: { value: 'active' } })

    expect(screen.getByRole('link', { name: 'محل الدفا' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'محل الخليل' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'محل بدون موقع' })).toBeNull()
  })

  it('shows why a shop without a location cannot be activated', async () => {
    admin({
      '/api/admin/cities': [nablus],
      '/api/admin/distributors': [shop({ isActive: false, googleMapsUrl: null, mapUrl: null })],
      '/api/admin/distributors/10/status': { status: 400, body: { errors: { isActive: ['أضف رابط خرائط Google أو الإحداثيات قبل تفعيل الموزع.'] } } },
    })
    renderApp('/admin/distributors')

    fireEvent.click(await screen.findByRole('button', { name: 'تفعيل محل الدفا' }))

    expect(await screen.findByText('أضف رابط خرائط Google أو الإحداثيات قبل تفعيل الموزع.')).toBeInTheDocument()
  })

  it('asks for a city first when none exist', async () => {
    admin({ '/api/admin/cities': [], '/api/admin/distributors': [] })
    renderApp('/admin/distributors')

    expect(await screen.findByText('أضف مدينة واحدة على الأقل قبل إضافة موزعين.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'إدارة المدن' })).toHaveAttribute('href', '/admin/cities')
  })

  it('saves a shop with its version and parsed coordinates', async () => {
    const fetchMock = admin({
      '/api/admin/cities': [nablus, hebron],
      '/api/admin/distributors/10': (body: unknown) => (body ? { ...shop(), version: 4 } : shop()),
      '/api/admin/distributors': [shop()],
    })
    renderApp('/admin/distributors/10')

    fireEvent.change(await screen.findByLabelText(/خط العرض/), { target: { value: '32.2215' } })
    fireEvent.change(screen.getByLabelText(/خط الطول/), { target: { value: '35.2544' } })
    fireEvent.change(screen.getByLabelText(/المدينة/), { target: { value: '2' } })
    expect(screen.getByRole('link', { name: /تجربة الرابط/ })).toHaveAttribute('href', 'https://maps.app.goo.gl/AbC')
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    await waitFor(() => expect(callsTo(fetchMock, '/api/admin/distributors/10', 'PUT')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/admin/distributors/10', 'PUT')[0])).toMatchObject({
      cityId: 2, latitude: 32.2215, longitude: 35.2544, version: 3,
    })
    expect(await screen.findByText('تم الحفظ.')).toBeInTheDocument()
  })

  it('shows map-link and activation errors from the server', async () => {
    admin({
      '/api/admin/cities': [nablus],
      '/api/admin/distributors/10': (body: unknown) =>
        body
          ? { status: 400, body: { errors: { googleMapsUrl: ['الصق رابطاً من خرائط Google يبدأ بـ https'], isActive: ['أضف رابط خرائط Google أو الإحداثيات قبل تفعيل الموزع.'] } } }
          : shop(),
    })
    renderApp('/admin/distributors/10')

    fireEvent.change(await screen.findByLabelText(/رابط خرائط Google/), { target: { value: 'javascript:alert(1)' } })
    expect(screen.queryByRole('link', { name: /تجربة الرابط/ })).toBeNull() // never linked
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('الصق رابطاً من خرائط Google يبدأ بـ https')).toBeInTheDocument()
    expect(screen.getByText('أضف رابط خرائط Google أو الإحداثيات قبل تفعيل الموزع.')).toBeInTheDocument()
  })
})
