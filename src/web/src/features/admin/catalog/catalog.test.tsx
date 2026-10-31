import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'
import type { AdminPackage, AdminProduct } from './catalogApi'

beforeAll(async () => {
  await import('../AdminApp')
})

const product = (overrides: Partial<AdminProduct> = {}): AdminProduct => ({
  id: 1, slug: 'body-warmer', name: 'لاصق تدفئة الجسم', shortDescription: null, description: null, usageGuidance: null, safetyInfo: null,
  widthCm: 10, heightCm: 13, heatMinHours: 8, heatMaxHours: 10, isAdhesive: true, piecesPerRetailBag: 1, sellingUnit: 'RetailBag',
  piecesPerSellingUnit: 1, unitPrice: 6, isActive: true, isCustomEligible: true, displayOrder: 1, usedInPackages: [], images: [], version: 11,
  ...overrides,
})

const hand = product({ id: 2, slug: 'hand-warmer', name: 'دفاية اليدين', unitPrice: 5, displayOrder: 2, piecesPerRetailBag: 2 })

type Call = [RequestInfo | URL, (RequestInit | undefined)?]
const callsTo = (fetchMock: { mock: { calls: Call[] } }, url: string, method: string) =>
  fetchMock.mock.calls.filter(([u, init]) => u === url && (init?.method ?? 'GET') === method)
const bodyOf = (call: Call) => JSON.parse(String(call[1]!.body))

function admin(routes: Record<string, unknown>) {
  return mockApi({ '/api/admin/auth/me': { email: 'admin@test.local' }, '/api/admin/dashboard': {}, ...routes })
}

describe('admin products', () => {
  it('lists products and reorders them', async () => {
    const fetchMock = admin({ '/api/admin/products': [product(), hand], '/api/admin/products/order': { status: 204 } })
    renderApp('/admin/products')

    expect(await screen.findByRole('link', { name: 'لاصق تدفئة الجسم' })).toHaveAttribute('href', '/admin/products/1')
    expect(screen.getByText('6 ₪ / كيس')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'تأخير لاصق تدفئة الجسم' }))

    await waitFor(() => expect(callsTo(fetchMock, '/api/admin/products/order', 'PUT')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/admin/products/order', 'PUT')[0])).toEqual({ ids: [2, 1] })
  })

  it('saves edits with the loaded version and parsed numbers', async () => {
    const fetchMock = admin({
      '/api/admin/products/1': (body: unknown) => (body ? { ...product(), ...(body as object), version: 12 } : product()),
      '/api/admin/products': [product()],
    })
    renderApp('/admin/products/1')

    const name = await screen.findByLabelText(/اسم المنتج/)
    fireEvent.change(name, { target: { value: 'لاصق الجسم' } })
    fireEvent.change(screen.getByLabelText(/سعر الوحدة/), { target: { value: '٦٫٥' } }) // Arabic digits and decimal mark
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    await waitFor(() => expect(callsTo(fetchMock, '/api/admin/products/1', 'PUT')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/admin/products/1', 'PUT')[0])).toMatchObject({
      name: 'لاصق الجسم', unitPrice: 6.5, widthCm: 10, isAdhesive: true, sellingUnit: 'RetailBag', version: 11,
    })
    expect(await screen.findByText('تم الحفظ.')).toBeInTheDocument()
  })

  it('creates a product and continues on its edit page for images', async () => {
    admin({
      '/api/admin/products': (body: unknown) => (body ? { ...product(), ...(body as object), id: 7, version: 1 } : []),
      '/api/admin/products/7': product({ id: 7, name: 'جديد', version: 1 }),
    })
    const { router } = renderApp('/admin/products/new')

    expect(await screen.findByText('احفظ المنتج أولاً ثم أضف الصور.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/اسم المنتج/), { target: { value: 'جديد' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/products/7'))
  })

  it('shows server validation errors under their fields', async () => {
    admin({
      '/api/admin/products/1': (body: unknown) =>
        body ? { status: 400, body: { errors: { slug: ['هذا المعرّف مستخدم لمنتج آخر.'], unitPrice: ['لا يمكن تفعيل منتج بدون سعر.'] } } } : product(),
    })
    renderApp('/admin/products/1')

    fireEvent.click(await screen.findByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('هذا المعرّف مستخدم لمنتج آخر.')).toBeInTheDocument()
    expect(screen.getByLabelText(/المعرّف في الرابط/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('راجع الحقول المحددة بالأحمر.')).toBeInTheDocument()
  })

  it('explains an edit conflict and offers to reload', async () => {
    admin({
      '/api/admin/products/1': (body: unknown) =>
        body ? { status: 409, body: { detail: 'تم تعديل هذا العنصر من مكان آخر بعد ما فتحته. حدّث الصفحة وأعد التعديل.' } } : product(),
    })
    renderApp('/admin/products/1')

    fireEvent.click(await screen.findByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText(/تم تعديل هذا العنصر من مكان آخر/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تحميل آخر نسخة' })).toBeInTheDocument()
  })

  it('warns before deleting a product that packages still use', async () => {
    admin({ '/api/admin/products/1': product({ usedInPackages: ['باقة الأسبوع'] }) })
    renderApp('/admin/products/1')

    fireEvent.click(await screen.findByRole('button', { name: /حذف/ }))

    const dialog = screen.getByRole('alertdialog', { name: 'حذف المنتج؟' })
    expect(within(dialog).getByText(/باقة الأسبوع/)).toBeInTheDocument()
  })

  it('uploads an image with its description', async () => {
    const fetchMock = admin({
      '/api/admin/products/1': product(),
      '/api/admin/products/1/images': { id: 5, url: '/media/products/x.webp', altText: 'صورة' },
    })
    renderApp('/admin/products/1')

    fireEvent.change(await screen.findByLabelText('وصف الصورة (اختياري)'), { target: { value: 'صورة' } })
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('رفع صورة'), { target: { files: [file] } })

    await waitFor(() => expect(callsTo(fetchMock, '/api/admin/products/1/images', 'POST')).toHaveLength(1))
    const [, init] = callsTo(fetchMock, '/api/admin/products/1/images', 'POST')[0]
    const form = init!.body as FormData
    expect((form.get('file') as File).name).toBe('photo.jpg')
    expect(form.get('altText')).toBe('صورة')
    expect((init!.headers as Record<string, string>)['X-Dafa-Admin']).toBe('1')
  })
})

describe('admin packages', () => {
  const weekly: AdminPackage = {
    id: 3, slug: 'weekly', name: 'باقة الأسبوع', description: null, imageUrl: null, price: 30, regularPrice: 40, isActive: true,
    isFeatured: true, displayOrder: 1, items: [{ productId: 1, productName: 'لاصق تدفئة الجسم', quantity: 5, productActive: true, productUnitPrice: 6 }], version: 4,
  }

  it('edits contents and shows the saving against buying items separately', async () => {
    const fetchMock = admin({
      '/api/admin/products': [product(), hand],
      '/api/admin/packages/3': (body: unknown) => (body ? { ...weekly, version: 5 } : weekly),
    })
    renderApp('/admin/packages/3')

    expect(await screen.findByText(/سعر المحتوى منفرداً: 30 ₪/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /إضافة منتج/ }))
    fireEvent.change(screen.getByLabelText('المنتج 2'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('الكمية 2'), { target: { value: '2' } })

    expect(await screen.findByText(/سعر المحتوى منفرداً: 40 ₪ · توفير للزبون: 10 ₪/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    await waitFor(() => expect(callsTo(fetchMock, '/api/admin/packages/3', 'PUT')).toHaveLength(1))
    expect(bodyOf(callsTo(fetchMock, '/api/admin/packages/3', 'PUT')[0])).toMatchObject({
      price: 30,
      items: [{ productId: 1, quantity: 5 }, { productId: 2, quantity: 2 }],
      version: 4,
    })
  })

  it('maps item errors to the right row', async () => {
    admin({
      '/api/admin/products': [product(), hand],
      '/api/admin/packages/3': (body: unknown) =>
        body ? { status: 400, body: { errors: { 'items[0].quantity': ['القيمة يجب أن تكون بين 1 و999.'] } } } : weekly,
    })
    renderApp('/admin/packages/3')

    fireEvent.click(await screen.findByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('القيمة يجب أن تكون بين 1 و999.')).toBeInTheDocument()
    expect(screen.getByLabelText('الكمية 1')).toHaveAttribute('aria-invalid', 'true')
  })
})
