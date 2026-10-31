import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { readyMadePackage } from '@/test/fixtures'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const card = async (name: string) => (await screen.findByRole('heading', { name })).closest('article')!

describe('packages page', () => {
  it('shows contents, price and savings against buying items separately', async () => {
    mockApi({ '/api/packages': [readyMadePackage()] })
    renderApp('/packages')

    const weekly = await card('باقة الأسبوع')
    const contents = within(weekly).getByRole('list', { name: 'محتوى الباقة' })
    expect(within(contents).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '5 × لاصق تدفئة الجسم',
      '2 × دفاية اليدين',
    ])
    expect(within(weekly).getByText('49 ₪')).toBeInTheDocument()
    expect(within(weekly).getByText('وفّر 1 ₪')).toBeInTheDocument()
  })

  it('labels featured packages without savings, and unavailable packages', async () => {
    mockApi({
      '/api/packages': [
        readyMadePackage({ id: 1, name: 'باقة مميزة', regularPrice: null }),
        readyMadePackage({ id: 2, name: 'باقة موقوفة', isAvailable: false }),
      ],
    })
    renderApp('/packages')

    expect(within(await card('باقة مميزة')).getByText('باقة مميّزة')).toBeInTheDocument()
    expect(within(await card('باقة موقوفة')).getByText('غير متوفرة حالياً')).toBeInTheDocument()
  })

  it('shows an empty state without packages', async () => {
    mockApi({ '/api/packages': [] })
    renderApp('/packages')

    expect(await screen.findByText('لا توجد باقات جاهزة حالياً.')).toBeInTheDocument()
  })
})
