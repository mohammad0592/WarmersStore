import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { product, quoteFor, readyMadePackage, rules } from '@/test/fixtures'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'
import { useCart } from './cartStore'

const body = product({ id: 1, slug: 'body-warmer', name: 'لاصق تدفئة الجسم', unitPrice: 6, piecesPerSellingUnit: 1 })
const hand = product({ id: 2, slug: 'hand-warmer', name: 'دفاية اليدين', unitPrice: 5, piecesPerSellingUnit: 2 })

function store(overrides: { rules?: ReturnType<typeof rules>; quote?: (b: unknown) => unknown } = {}) {
  return mockApi({
    '/api/packages': [readyMadePackage()],
    '/api/products': [body, hand],
    '/api/custom-package-rules': overrides.rules ?? rules(),
    '/api/checkout/quote': overrides.quote ?? ((b: unknown) => quoteFor(b)),
  })
}

const openCart = () => fireEvent.click(screen.getByRole('button', { name: /فتح سلة المشتريات/ }))
const drawer = () => screen.getByRole('dialog', { name: 'سلة المشتريات' })
const builderCard = (name: string) => screen.getAllByRole('heading', { name }).map((h) => h.closest('article')!).find((a) => within(a).queryByRole('group'))!

describe('ready-made packages → cart', () => {
  it('adds the chosen quantity, confirms, and updates the header count', async () => {
    store()
    renderApp('/packages')

    const card = (await screen.findByRole('heading', { name: 'باقة الأسبوع' })).closest('article')!
    fireEvent.click(within(card).getByRole('button', { name: 'زيادة الكمية: باقة الأسبوع' }))
    fireEvent.click(within(card).getByRole('button', { name: /أضف للسلة/ }))

    expect(await screen.findByText('أضفنا باقة الأسبوع للسلة')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'فتح سلة المشتريات (2)' })).toBeInTheDocument()
    expect(useCart.getState().lines).toMatchObject([{ kind: 'ReadyMade', packageId: 10, quantity: 2 }])
  })

  it('cannot add an unavailable package', async () => {
    mockApi({ '/api/packages': [readyMadePackage({ isAvailable: false })], '/api/products': [], '/api/custom-package-rules': rules() })
    renderApp('/packages')

    const card = (await screen.findByRole('heading', { name: 'باقة الأسبوع' })).closest('article')!
    expect(within(card).getByRole('button', { name: /أضف للسلة/ })).toBeDisabled()
  })
})

describe('cart drawer', () => {
  it('shows server prices and totals, and updates them when the quantity changes', async () => {
    store()
    useCart.getState().addReadyMade(10, 'باقة الأسبوع', 1)
    renderApp('/')
    openCart()

    expect(await within(drawer()).findByText('الإجمالي التقديري')).toBeInTheDocument()
    expect(within(drawer()).getAllByText('49 ₪').length).toBeGreaterThan(0)

    fireEvent.click(within(drawer()).getByRole('button', { name: 'زيادة الكمية: باقة الأسبوع' }))
    expect(await within(drawer()).findAllByText('98 ₪')).not.toHaveLength(0)
  })

  it('shows per-line problems reported by the server', async () => {
    useCart.getState().addReadyMade(10, 'باقة قديمة', 1)
    const lineId = useCart.getState().lines[0].lineId
    store({ quote: (b) => quoteFor(b, { lineErrors: { [lineId]: 'هذه الباقة لم تعد متوفرة.' } }) })
    renderApp('/')
    openCart()

    expect(await within(drawer()).findByText('هذه الباقة لم تعد متوفرة.')).toBeInTheDocument()
  })

  it('removes lines and shows the empty state', async () => {
    store()
    useCart.getState().addReadyMade(10, 'باقة الأسبوع', 1)
    renderApp('/')
    openCart()

    fireEvent.click(await within(drawer()).findByRole('button', { name: 'حذف باقة الأسبوع من السلة' }))

    expect(within(drawer()).getByText('سلتك فاضية.')).toBeInTheDocument()
    expect(useCart.getState().lines).toEqual([])
  })

  it('closes with Escape', async () => {
    store()
    renderApp('/')
    openCart()
    expect(drawer()).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('duplicates a custom package', async () => {
    store()
    useCart.getState().addCustom([{ productId: 1, quantity: 2 }])
    renderApp('/')
    openCart()

    fireEvent.click(await within(drawer()).findByRole('button', { name: /^نسخ/ }))

    await waitFor(() => expect(within(drawer()).getByText('باقة مخصّصة 2')).toBeInTheDocument())
    expect(useCart.getState().lines).toHaveLength(2)
  })
})

describe('custom package builder', () => {
  it('prices the selection live and adds it to the cart', async () => {
    store()
    renderApp('/packages')

    const bodyCard = await waitFor(() => builderCard('لاصق تدفئة الجسم'))
    fireEvent.click(within(bodyCard).getByRole('button', { name: 'زيادة الكمية: لاصق تدفئة الجسم' }))
    fireEvent.click(within(bodyCard).getByRole('button', { name: 'زيادة الكمية: لاصق تدفئة الجسم' }))
    fireEvent.click(within(builderCard('دفاية اليدين')).getByRole('button', { name: 'زيادة الكمية: دفاية اليدين' }))

    const summary = screen.getByText('ملخص باقتك').closest('aside')!
    expect(within(summary).getByText('17 ₪')).toBeInTheDocument() // 2 × 6 + 1 × 5
    expect(within(summary).getByText('باقتك جاهزة للإضافة للسلة.')).toBeInTheDocument()

    fireEvent.click(within(summary).getByRole('button', { name: /أضف الباقة للسلة/ }))

    expect(useCart.getState().lines).toMatchObject([{ kind: 'Custom', items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] }])
    expect(within(summary).getByText('0 ₪')).toBeInTheDocument() // reset for the next package
  })

  it('explains configured limits and blocks adding until they are met', async () => {
    store({ rules: rules({ minItems: 3, maxQuantityPerProduct: 2 }) })
    renderApp('/packages')

    const bodyCard = await waitFor(() => builderCard('لاصق تدفئة الجسم'))
    const summary = screen.getByText('ملخص باقتك').closest('aside')!
    expect(within(summary).getByText('ابدأ باختيار 3 وحدات على الأقل.')).toBeInTheDocument()

    const increase = within(bodyCard).getByRole('button', { name: 'زيادة الكمية: لاصق تدفئة الجسم' })
    fireEvent.click(increase)
    fireEvent.click(increase)
    expect(increase).toBeDisabled() // store-wide max per product is 2
    expect(within(summary).getByText('أضف 1 وحدات كمان لإكمال الباقة.')).toBeInTheDocument()
    expect(within(summary).getByRole('button', { name: /أضف الباقة للسلة/ })).toBeDisabled()
  })

  it('is hidden when the admin disables custom packages', async () => {
    store({ rules: rules({ isEnabled: false }) })
    renderApp('/packages')

    expect(await screen.findByText('تصميم الباقات غير متاح حالياً.')).toBeInTheDocument()
  })

  it('edits a custom package from the cart in place', async () => {
    store()
    const lineId = useCart.getState().addCustom([{ productId: 1, quantity: 2 }])
    renderApp(`/packages?edit=${lineId}#custom`)

    const summary = (await screen.findByText('ملخص باقتك')).closest('aside')!
    expect(within(summary).getByText('عم تعدّل باقة من سلتك')).toBeInTheDocument()
    expect(within(summary).getAllByText('12 ₪')).toHaveLength(2) // the line and the total

    fireEvent.click(within(builderCard('دفاية اليدين')).getByRole('button', { name: 'زيادة الكمية: دفاية اليدين' }))
    fireEvent.click(within(summary).getByRole('button', { name: /حفظ التعديلات/ }))

    expect(useCart.getState().lines).toEqual([
      { lineId, kind: 'Custom', items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] },
    ])
  })
})
