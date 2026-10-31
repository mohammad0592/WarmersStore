import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'
import type { AdminOrder } from '../orders/ordersApi'
import type { AdminCustomRules, AdminDeliverySettings, AdminStoreSettings } from './settingsApi'

beforeAll(async () => {
  await import('../AdminApp')
})

type Call = [RequestInfo | URL, (RequestInit | undefined)?]
const callsTo = (fetchMock: { mock: { calls: Call[] } }, url: string, method: string) =>
  fetchMock.mock.calls.filter(([u, init]) => u === url && (init?.method ?? 'GET') === method)
const bodyOf = (call: Call) => JSON.parse(String(call[1]!.body))

function admin(routes: Record<string, unknown>) {
  return mockApi({ '/api/admin/auth/me': { email: 'admin@test.local' }, '/api/admin/dashboard': {}, ...routes })
}

const storeSettings: AdminStoreSettings = {
  storeName: 'دفا', logoUrl: null, whatsAppNumber: null, phone: null, email: null, address: null,
  facebookUrl: null, instagramUrl: null, tikTokUrl: null, announcement: null, announcementActive: false,
  minOrderTotal: null, showDistributors: false, heroTitle: null, heroDescription: null, whereToFindText: null,
}

describe('admin store settings', () => {
  it('saves the WhatsApp number and distributor switch, and shows field errors', async () => {
    const fetchMock = admin({
      '/api/admin/store-settings': (body: unknown) =>
        body && (body as AdminStoreSettings).email === 'nope'
          ? { status: 400, body: { errors: { email: ['البريد الإلكتروني غير صالح.'] } } }
          : body
            ? { ...storeSettings, whatsAppNumber: '+970599000000', showDistributors: true }
            : storeSettings,
    })
    renderApp('/admin/settings')

    fireEvent.change(await screen.findByLabelText('رقم واتساب المتجر'), { target: { value: '059 900 0000' } })
    fireEvent.click(screen.getByLabelText('إظهار صفحة الموزعين في الموقع'))
    fireEvent.change(screen.getByLabelText('الحد الأدنى للطلب (₪)'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('تم الحفظ.')).toBeInTheDocument()
    const body = bodyOf(callsTo(fetchMock, '/api/admin/store-settings', 'PUT')[0])
    expect(body).toMatchObject({ whatsAppNumber: '059 900 0000', showDistributors: true, minOrderTotal: 50, heroTitle: '' })
    // The saved, normalized number replaces what was typed.
    expect(screen.getByLabelText('رقم واتساب المتجر')).toHaveValue('+970599000000')

    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(await screen.findByText('البريد الإلكتروني غير صالح.')).toBeInTheDocument()
  })
})

describe('admin custom package rules', () => {
  it('sends empty limits as null and adds discount tiers', async () => {
    const rules: AdminCustomRules = { isEnabled: true, minItems: 2, maxItems: null, minSubtotal: null, maxQuantityPerProduct: null, productRules: [], discountTiers: [] }
    const fetchMock = admin({
      '/api/admin/custom-package-rules': (body: unknown) => (body ? { ...rules, minItems: null, discountTiers: [{ minItems: 10, type: 'Percent', value: 5, isActive: true }] } : rules),
      '/api/admin/products': [],
    })
    renderApp('/admin/custom-packages')

    fireEvent.change(await screen.findByLabelText('أقل عدد وحدات في الباقة'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /إضافة خصم/ }))
    fireEvent.change(screen.getByLabelText('من عدد وحدات'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('قيمة الخصم'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('تم الحفظ.')).toBeInTheDocument()
    expect(bodyOf(callsTo(fetchMock, '/api/admin/custom-package-rules', 'PUT')[0])).toEqual({
      isEnabled: true, minItems: null, maxItems: null, minSubtotal: null, maxQuantityPerProduct: null,
      productRules: [], discountTiers: [{ minItems: 10, type: 'Percent', value: 5, isActive: true }],
    })
  })
})

describe('admin delivery', () => {
  it('asks for a fee only in flat mode', async () => {
    const settings: AdminDeliverySettings = { mode: 'None', flatFee: null, freeDeliveryThreshold: null, message: null }
    const fetchMock = admin({
      '/api/admin/delivery-settings': (body: unknown) => (body ? { ...settings, mode: 'Flat', flatFee: 20 } : settings),
      '/api/admin/delivery-areas': [],
    })
    renderApp('/admin/delivery')

    expect(await screen.findByText('لا توجد مناطق توصيل بعد.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/رسوم التوصيل/)).toBeNull()

    fireEvent.change(screen.getByLabelText('طريقة الاحتساب'), { target: { value: 'Flat' } })
    fireEvent.change(await screen.findByLabelText(/رسوم التوصيل/), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('تم الحفظ.')).toBeInTheDocument()
    expect(bodyOf(callsTo(fetchMock, '/api/admin/delivery-settings', 'PUT')[0])).toEqual({ mode: 'Flat', flatFee: 20, freeDeliveryThreshold: null, message: '' })
  })
})

const order = (overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  id: 7, reference: 'DF-261031-AB12', status: 'PendingConfirmation', statusChangedAt: '2026-10-31T10:00:00Z', createdAt: '2026-10-31T10:00:00Z',
  customerName: 'سارة', customerWhatsApp: '+970599123456', address: 'نابلس، شارع فيصل', deliveryInstructions: null, notes: 'رن الجرس',
  deliveryMode: 'None', deliveryAreaName: null, subtotal: 18, discountTotal: 0, deliveryFee: 0, total: 18,
  whatsAppMessage: 'طلب جديد DF-261031-AB12', allowedNextStatuses: ['Confirmed', 'Cancelled'],
  items: [{ kind: 'Custom', name: 'باقة مخصّصة', quantity: 1, unitPrice: null, subtotal: 18, discount: 0, lineTotal: 18, products: [{ productName: 'لصقة الجسم', quantity: 3, pieces: 3, unitPrice: 6, subtotal: 18 }] }],
  ...overrides,
})

describe('admin orders', () => {
  it('lists orders and filters by status through the URL', async () => {
    const summary = { id: 7, reference: 'DF-261031-AB12', status: 'PendingConfirmation', customerName: 'سارة', customerWhatsApp: '+970599123456', total: 18, itemCount: 1, createdAt: '2026-10-31T10:00:00Z' }
    const fetchMock = admin({
      '/api/admin/orders': { items: [summary], total: 1, page: 1, pageSize: 25 },
      '/api/admin/orders?status=Cancelled': { items: [], total: 0, page: 1, pageSize: 25 },
    })
    const { router } = renderApp('/admin/orders')

    const row = await screen.findByRole('link', { name: /DF-261031-AB12 · سارة/ })
    expect(row).toHaveAttribute('href', '/admin/orders/7')
    expect(within(row).getByText('بانتظار التأكيد')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('تصفية حسب الحالة'), { target: { value: 'Cancelled' } })
    expect(await screen.findByText('لا توجد طلبات مطابقة.')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?status=Cancelled')
    expect(callsTo(fetchMock, '/api/admin/orders?status=Cancelled', 'GET')).toHaveLength(1)
  })

  it('confirms an order only after the admin confirms in a dialog', async () => {
    const fetchMock = admin({
      '/api/admin/orders/7': order(),
      '/api/admin/orders/7/status': order({ status: 'Confirmed', allowedNextStatuses: ['Completed', 'Cancelled'] }),
    })
    renderApp('/admin/orders/7')

    expect(await screen.findByText('طلب جديد DF-261031-AB12')).toBeInTheDocument()
    expect(screen.getByText(/فتح الزبون لواتساب لا يعني أنه أرسل الرسالة/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /فتح المحادثة/ })).toHaveAttribute('href', 'https://wa.me/970599123456')

    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    const dialog = screen.getByRole('alertdialog', { name: 'تغيير حالة الطلب' })
    expect(callsTo(fetchMock, '/api/admin/orders/7/status', 'PATCH')).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'تأكيد الطلب' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'تم التسليم' })).toBeInTheDocument())
    expect(bodyOf(callsTo(fetchMock, '/api/admin/orders/7/status', 'PATCH')[0])).toEqual({ status: 'Confirmed' })
    expect(screen.getByText('مؤكد')).toBeInTheDocument()
  })
})
