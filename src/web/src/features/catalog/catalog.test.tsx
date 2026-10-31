import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { product } from '@/test/fixtures'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('products page', () => {
  it('lists products with duration, adhesive status, size and bag contents', async () => {
    mockApi({ '/api/products': [product(), product({ id: 3, slug: 'foot-warmer', name: 'دفاية القدم', isAdhesive: null, heatMinHours: 3, heatMaxHours: 4 })] })
    renderApp('/products')

    const hand = (await screen.findByRole('link', { name: 'دفاية اليدين' })).closest('article')!
    expect(within(hand).getByText('8–10 ساعات')).toBeInTheDocument()
    expect(within(hand).getByText('غير لاصق')).toBeInTheDocument()
    expect(within(hand).getByText('5.5 × 9 سم · الكيس فيه قطعتان')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'دفاية اليدين' })).toHaveAttribute('href', '/products/hand-warmer')

    // Unknown adhesive status is left out rather than guessed.
    const foot = screen.getByRole('link', { name: 'دفاية القدم' }).closest('article')!
    expect(within(foot).queryByText(/لاصق/)).toBeNull()
  })

  it('shows an empty state when no products are active', async () => {
    mockApi({ '/api/products': [] })
    renderApp('/products')

    expect(await screen.findByText('لسه بنجهّز المنتجات. ارجع لنا قريباً.')).toBeInTheDocument()
  })

  it('shows an error with a working retry', async () => {
    const fetchMock = mockApi({ '/api/products': { status: 500 } })
    renderApp('/products')

    fireEvent.click(await screen.findByRole('button', { name: 'حاول مرة ثانية' }))

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/products')).toHaveLength(2)
  })
})

describe('product details dialog', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'تفاصيل المنتج' })

  it('opens over the catalog with specifications, leaving out guidance not yet supplied', async () => {
    mockApi({ '/api/products': [product()], '/api/products/hand-warmer': product() })
    renderApp('/products/hand-warmer')

    expect(await within(dialog()).findByRole('heading', { level: 2, name: 'دفاية اليدين' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'منتجاتنا' })).toBeInTheDocument() // the list stays behind
    expect(within(dialog()).getByText('8–10 ساعات تقريباً')).toBeInTheDocument()
    expect(within(dialog()).getByText('بالكيس (قطعتان)')).toBeInTheDocument()
    expect(within(dialog()).queryByText('طريقة الاستخدام')).toBeNull()
    expect(within(dialog()).queryByText('تنبيه مهم')).toBeNull()
    expect(within(dialog()).getByRole('link', { name: 'شوف الباقات المتاحة' })).toHaveAttribute('href', '/packages')
    await waitFor(() => expect(document.title).toBe('دفاية اليدين | دفا'))
  })

  it('opens from a product card and closes back to the list', async () => {
    mockApi({ '/api/products': [product()], '/api/products/hand-warmer': product() })
    const { router } = renderApp('/products')

    fireEvent.click(await screen.findByRole('link', { name: 'دفاية اليدين' }))
    expect(await screen.findByRole('dialog', { name: 'تفاصيل المنتج' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/products/hand-warmer')

    fireEvent.click(within(dialog()).getAllByRole('button', { name: 'إغلاق' }).at(-1)!)

    expect(router.state.location.pathname).toBe('/products')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.title).toBe('منتجاتنا | دفا'))
  })

  it('closes with Escape', async () => {
    mockApi({ '/api/products': [product()], '/api/products/hand-warmer': product() })
    const { router } = renderApp('/products/hand-warmer')
    await screen.findByRole('dialog', { name: 'تفاصيل المنتج' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(router.state.location.pathname).toBe('/products')
  })

  it('shows usage and safety guidance when the business has supplied it', async () => {
    mockApi({ '/api/products': [], '/api/products/hand-warmer': product({ usageGuidance: 'افتح العبوة.', safetyInfo: 'تنبيه من المورّد.' }) })
    renderApp('/products/hand-warmer')

    expect(await screen.findByText('افتح العبوة.')).toBeInTheDocument()
    expect(within(dialog()).getByRole('heading', { name: 'تنبيه مهم' })).toBeInTheDocument()
    expect(screen.getByText('تنبيه من المورّد.')).toBeInTheDocument()
  })

  it('handles an inactive or unknown product', async () => {
    mockApi({ '/api/products': [] })
    renderApp('/products/gone')

    expect(await within(dialog()).findByText('هذا المنتج غير متوفر حالياً.')).toBeInTheDocument()
  })
})
