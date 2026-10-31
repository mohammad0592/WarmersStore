import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCart } from '@/features/cart/cartStore'
import { browser } from '@/lib/browser'
import { quoteFor } from '@/test/fixtures'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const WA_URL = 'https://wa.me/970599000000?text=%D8%B7%D9%84%D8%A8'

function api(overrides: Record<string, unknown> = {}) {
  return mockApi({
    '/api/delivery-options': { mode: 'None', flatFee: null, freeDeliveryThreshold: null, message: null, areas: [] },
    '/api/checkout/quote': (body: unknown) => quoteFor(body),
    '/api/checkout/submit': (body: unknown) => ({
      reference: 'DF-261031-7K3Q',
      quote: quoteFor(body),
      message: 'طلب',
      whatsAppUrl: WA_URL,
    }),
    ...overrides,
  })
}

const field = (label: RegExp) => screen.getByLabelText(label)
const sendButton = () => screen.getByRole('button', { name: /إرسال الطلب عبر واتساب/ })

function fillForm() {
  fireEvent.change(field(/الاسم الكامل/), { target: { value: 'محمد أحمد' } })
  fireEvent.change(field(/رقم الواتساب/), { target: { value: '0599 123 456' } })
  fireEvent.change(field(/عنوان التوصيل/), { target: { value: 'نابلس، شارع فيصل' } })
}

describe('checkout', () => {
  beforeEach(() => {
    useCart.getState().addReadyMade(10, 'باقة الأسبوع', 2)
  })

  it('shows the server-priced summary and cash on delivery', async () => {
    api()
    renderApp('/checkout', { whatsAppNumber: '+970599000000' })

    const summary = (await screen.findByRole('heading', { name: 'ملخص الطلب' })).closest('aside')!
    expect(await within(summary).findByText('باقة الأسبوع × 2')).toBeInTheDocument()
    expect(within(summary).getAllByText('98 ₪').length).toBeGreaterThan(0)
    expect(within(summary).getByText(/الدفع نقداً عند الاستلام/)).toBeInTheDocument()
  })

  it('submits, clears the cart, shows the reference and opens WhatsApp', async () => {
    const fetchMock = api()
    const open = vi.spyOn(browser, 'open').mockImplementation(() => {})
    const { router } = renderApp('/checkout', { whatsAppNumber: '+970599000000' })

    await waitFor(() => expect(sendButton()).toBeEnabled())
    fillForm()
    fireEvent.click(sendButton())

    await waitFor(() => expect(open).toHaveBeenCalledWith(WA_URL))
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/checkout/submit')!
    const body = JSON.parse(String(init!.body))
    expect(body.customer).toEqual({
      fullName: 'محمد أحمد',
      whatsAppNumber: '+970599123456',
      address: 'نابلس، شارع فيصل',
      deliveryInstructions: null,
      notes: null,
    })
    expect(body.submissionId).toEqual(expect.any(String))
    expect(body.lines).toEqual([{ lineId: expect.any(String), kind: 'ReadyMade', packageId: 10, quantity: 2 }])

    expect(useCart.getState().lines).toEqual([])
    expect(router.state.location.pathname).toBe('/checkout/sent')
    expect(await screen.findByText('DF-261031-7K3Q')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /افتح واتساب مرة ثانية/ })).toHaveAttribute('href', WA_URL)
    expect(screen.getByText(/ما بنعتبر الطلب مؤكداً قبل إرسال الرسالة/)).toBeInTheDocument()
  })

  it('validates required fields before sending anything', async () => {
    const fetchMock = api()
    renderApp('/checkout', { whatsAppNumber: '+970599000000' })

    await waitFor(() => expect(sendButton()).toBeEnabled())
    fireEvent.change(field(/رقم الواتساب/), { target: { value: '123' } })
    fireEvent.click(sendButton())

    expect(await screen.findByText('الرجاء إدخال الاسم الكامل.')).toBeInTheDocument()
    expect(screen.getByText('الرجاء إدخال رقم واتساب صحيح.')).toBeInTheDocument()
    expect(screen.getByText('الرجاء إدخال عنوان التوصيل بالتفصيل.')).toBeInTheDocument()
    expect(field(/الاسم الكامل/)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/checkout/submit')).toBe(false)
  })

  it('shows field errors returned by the server', async () => {
    api({
      '/api/checkout/submit': { status: 400, body: { errors: { 'customer.address': ['العنوان غير كافٍ.'] } } },
    })
    renderApp('/checkout', { whatsAppNumber: '+970599000000' })

    await waitFor(() => expect(sendButton()).toBeEnabled())
    fillForm()
    fireEvent.click(sendButton())

    expect(await screen.findByText('العنوان غير كافٍ.')).toBeInTheDocument()
    expect(useCart.getState().lines).toHaveLength(1)
  })

  it('shows business-rule problems from a rejected submission and keeps the cart', async () => {
    api({
      '/api/checkout/submit': (body: unknown) => ({
        status: 422,
        body: { ...quoteFor(body), isValid: false, errors: [{ code: 'min_order_total', message: 'الحد الأدنى للطلب 100 ₪.', params: null }] },
      }),
    })
    const open = vi.spyOn(browser, 'open').mockImplementation(() => {})
    renderApp('/checkout', { whatsAppNumber: '+970599000000' })

    await waitFor(() => expect(sendButton()).toBeEnabled())
    fillForm()
    fireEvent.click(sendButton())

    expect(await screen.findByText('الحد الأدنى للطلب 100 ₪.')).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
    expect(useCart.getState().lines).toHaveLength(1)
  })

  it('is unavailable until the store WhatsApp number is configured', async () => {
    api()
    renderApp('/checkout')

    expect(screen.getByText('استقبال الطلبات غير متاح حالياً، حاول لاحقاً.')).toBeInTheDocument()
    await screen.findByText('باقة الأسبوع × 2')
    expect(sendButton()).toBeDisabled()
  })

  it('requires a delivery area in per-area mode and prices it', async () => {
    const fetchMock = api({
      '/api/delivery-options': {
        mode: 'PerArea', flatFee: null, freeDeliveryThreshold: null, message: null,
        areas: [{ id: 7, name: 'نابلس', fee: 15, freeDeliveryThreshold: null, note: null }],
      },
    })
    renderApp('/checkout', { whatsAppNumber: '+970599000000' })

    const area = await screen.findByLabelText(/منطقة التوصيل/)
    fillForm()
    fireEvent.click(sendButton())
    expect(await screen.findByText('اختار منطقة التوصيل.')).toBeInTheDocument()

    fireEvent.change(area, { target: { value: '7' } })
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/checkout/quote' && JSON.parse(String(init!.body)).deliveryAreaId === 7)).toBe(true),
    )
  })

  it('shows an empty state without a cart', () => {
    useCart.setState({ lines: [] })
    api()
    renderApp('/checkout')

    expect(screen.getByText('سلتك فاضية.')).toBeInTheDocument()
  })
})

describe('sent page', () => {
  it('explains there is no recent order when opened directly', () => {
    renderApp('/checkout/sent')

    expect(screen.getByText('ما في طلب حديث بهذه الصفحة.')).toBeInTheDocument()
  })

  it('ignores a tampered stored link that is not wa.me', () => {
    window.sessionStorage.setItem('dafa-last-order', JSON.stringify({ reference: 'X', whatsAppUrl: 'https://evil.example' }))
    renderApp('/checkout/sent')

    expect(screen.queryByRole('link', { name: /افتح واتساب/ })).toBeNull()
  })
})
