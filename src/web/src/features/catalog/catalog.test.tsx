import { fireEvent, screen, within } from '@testing-library/react'
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

describe('product details page', () => {
  it('shows specifications and leaves out guidance that has not been supplied', async () => {
    mockApi({ '/api/products/hand-warmer': product() })
    renderApp('/products/hand-warmer')

    expect(await screen.findByRole('heading', { level: 1, name: 'دفاية اليدين' })).toBeInTheDocument()
    expect(screen.getByText('8–10 ساعات تقريباً')).toBeInTheDocument()
    expect(screen.getByText('بالكيس (قطعتان)')).toBeInTheDocument()
    expect(screen.queryByText('طريقة الاستخدام')).toBeNull()
    expect(screen.queryByText('تنبيه مهم')).toBeNull()
    expect(screen.getByRole('link', { name: /شوف الباقات المتاحة/ })).toHaveAttribute('href', '/packages')
    expect(document.title).toBe('دفاية اليدين | دفا')
  })

  it('shows usage and safety guidance when the business has supplied it', async () => {
    mockApi({ '/api/products/hand-warmer': product({ usageGuidance: 'افتح العبوة.', safetyInfo: 'تنبيه من المورّد.' }) })
    renderApp('/products/hand-warmer')

    expect(await screen.findByText('افتح العبوة.')).toBeInTheDocument()
    expect(screen.getByText('تنبيه من المورّد.')).toBeInTheDocument()
  })

  it('handles an inactive or unknown product', async () => {
    mockApi({})
    renderApp('/products/gone')

    expect(await screen.findByText('هذا المنتج غير متوفر حالياً.')).toBeInTheDocument()
  })
})
