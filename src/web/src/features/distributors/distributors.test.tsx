import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { city, distributor, hebron, nablus } from '@/test/fixtures'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const directory = {
  '/api/cities': [city(nablus, 2), city(hebron, 1)],
  '/api/distributors': [
    distributor({ id: 1, name: 'محل نابلس الأول', phone: '+970590000001' }),
    distributor({ id: 2, name: 'محل نابلس الثاني', mapUrl: null }),
    distributor({ id: 3, name: 'محل الخليل', city: hebron }),
  ],
}

const cardFor = (name: string) => screen.getByRole('heading', { name }).closest('article')!

describe('distributors page', () => {
  it('shows the intro and the in-store-only notice', async () => {
    mockApi(directory)
    renderApp('/distributors')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('موزعونا المعتمدون')
    expect(screen.getByText(/بتفضّل تشتري من المحل؟/)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('الشراء من الموزعين يتم من داخل المحل فقط، ولا تتوفر خدمة التوصيل من خلالهم.')
    expect(await screen.findByRole('heading', { name: 'محل الخليل' })).toBeInTheDocument()
  })

  it('groups distributors by city and filters through the URL', async () => {
    mockApi(directory)
    const { router } = renderApp('/distributors')

    await screen.findByRole('heading', { name: 'محل الخليل' })
    const main = screen.getByRole('main')
    expect(within(main).getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim())).toEqual(['نابلس', 'الخليل'])

    const filter = screen.getByRole('navigation', { name: 'اختار المدينة' })
    expect(within(filter).getAllByRole('link').map((l) => l.textContent)).toEqual(['كل المدن (3)', 'نابلس (2)', 'الخليل (1)'])

    fireEvent.click(within(filter).getByRole('link', { name: 'الخليل (1)' }))

    expect(router.state.location.search).toBe('?city=hebron')
    expect(within(filter).getByRole('link', { name: 'الخليل (1)' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('heading', { name: 'محل الخليل' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'محل نابلس الأول' })).toBeNull()
  })

  it('opens the map in a new tab and offers a call link when there is a phone', async () => {
    mockApi(directory)
    renderApp('/distributors?city=nablus')

    await screen.findByRole('heading', { name: 'محل نابلس الأول' })
    const first = cardFor('محل نابلس الأول')
    const map = within(first).getByRole('link', { name: /عرض الموقع على الخريطة/ })
    expect(map).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=32.2215,35.2544')
    expect(map).toHaveAttribute('target', '_blank')
    expect(map).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(first).getByText('موزع معتمد')).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: '+970590000001' })).toHaveAttribute('href', 'tel:+970590000001')

    const second = cardFor('محل نابلس الثاني')
    expect(within(second).queryByRole('link')).toBeNull()
    expect(within(second).getByText('الموقع على الخريطة غير متوفر بعد')).toBeInTheDocument()
  })

  it('never renders a non-https map link', async () => {
    mockApi({
      '/api/cities': [city(nablus, 1)],
      '/api/distributors': [distributor({ mapUrl: 'javascript:alert(1)' })],
    })
    renderApp('/distributors')

    await screen.findByRole('heading', { name: 'محل تجريبي' })
    expect(within(cardFor('محل تجريبي')).queryByRole('link')).toBeNull()
  })

  it('has nothing to order: no cart, add or delivery buttons', async () => {
    mockApi(directory)
    renderApp('/distributors')

    await screen.findByRole('heading', { name: 'محل الخليل' })
    const page = screen.getByRole('main')
    expect(within(page).queryAllByRole('button')).toHaveLength(0)
    expect(within(page).queryByText(/أضف للسلة|اطلب الآن|توصيل الطلب/)).toBeNull()
  })

  it('shows an empty state for a city without distributors', async () => {
    mockApi(directory)
    renderApp('/distributors?city=jenin')

    expect(await screen.findByText('ما في موزعين معتمدين بهذه المدينة حالياً.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'عرض كل المدن' })).toHaveAttribute('href', '/distributors')
  })

  it('shows a coming-soon state with a link to order online when there are no distributors', async () => {
    mockApi({ '/api/cities': [], '/api/distributors': [] })
    renderApp('/distributors')

    expect(await screen.findByText('قريباً بتلاقي منتجاتنا عند موزعين معتمدين في مدن مختلفة.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'اطلب أونلاين مع التوصيل' })).toHaveAttribute('href', '/packages')
    expect(screen.queryByRole('navigation', { name: 'اختار المدينة' })).toBeNull()
  })

  it('shows an error with retry when loading fails', async () => {
    mockApi({ '/api/cities': { status: 500 }, '/api/distributors': [] })
    renderApp('/distributors')

    expect(await screen.findByRole('button', { name: 'حاول مرة ثانية' })).toBeInTheDocument()
  })
})
