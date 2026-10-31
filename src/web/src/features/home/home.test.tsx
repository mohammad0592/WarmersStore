import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { product, readyMadePackage } from '@/test/fixtures'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('home page', () => {
  it('shows the ordering steps and cash-on-delivery note', async () => {
    mockApi({ '/api/products': [], '/api/packages': [] })
    renderApp('/')

    const steps = screen.getByRole('heading', { name: 'طلبك بأربع خطوات بسيطة' }).closest('section')!
    expect(within(steps).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'اختر باقاتك',
      'أضفها للسلة',
      'أدخل معلومات التوصيل',
      'أرسل طلبك عبر واتساب',
    ])
    expect(within(steps).getByText(/الدفع نقداً عند الاستلام/)).toBeInTheDocument()
  })

  it('features marked packages and hides empty sections', async () => {
    mockApi({
      '/api/products': [],
      '/api/packages': [
        readyMadePackage({ id: 1, name: 'باقة عادية', isFeatured: false }),
        readyMadePackage({ id: 2, name: 'باقة العائلة', isFeatured: true }),
      ],
    })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'باقة العائلة' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'باقة عادية' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'منتجات صغيرة، فرقها كبير' })).toBeNull()
  })

  it('shows up to four products', async () => {
    mockApi({
      '/api/products': [1, 2, 3, 4, 5].map((id) => product({ id, slug: `p${id}`, name: `منتج ${id}` })),
      '/api/packages': [],
    })
    renderApp('/')

    expect(await screen.findByRole('link', { name: 'منتج 4' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'منتج 5' })).toBeNull()
  })

  it('keeps online ordering and in-store buying separate in "وين بتلاقينا؟"', async () => {
    mockApi({ '/api/products': [], '/api/packages': [] })
    renderApp('/', { showDistributors: true })

    const section = screen.getByRole('region', { name: 'وين بتلاقينا؟' })
    expect(within(section).getByRole('link', { name: /اكتشف موزعينا/ })).toHaveAttribute('href', '/distributors')
    expect(within(section).getByRole('link', { name: /تسوّق الباقات/ })).toHaveAttribute('href', '/packages')
    expect(within(section).getByText('الشراء من داخل المحل فقط، بدون توصيل.')).toBeInTheDocument()
  })

  it('hides "وين بتلاقينا؟" while distributors are switched off', () => {
    mockApi({ '/api/products': [], '/api/packages': [] })
    renderApp('/')

    expect(screen.queryByRole('region', { name: 'وين بتلاقينا؟' })).toBeNull()
  })

  it('offers WhatsApp contact only once the store number is configured', () => {
    mockApi({ '/api/products': [], '/api/packages': [] })
    renderApp('/', { whatsAppNumber: '+970599000000' })

    const cta = screen.getByRole('link', { name: 'احكِ معنا على واتساب' })
    expect(cta).toHaveAttribute('href', 'https://wa.me/970599000000')
  })
})
