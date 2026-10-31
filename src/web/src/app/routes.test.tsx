import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('routes', () => {
  beforeEach(() => {
    mockApi({ '/api/products': [], '/api/packages': [], '/api/cities': [], '/api/distributors': [] })
  })

  it('renders the Arabic home page', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('خليك دافي وين ما كنت')
  })

  it.each([
    ['/products', 'منتجاتنا'],
    ['/packages', 'الباقات'],
    ['/distributors', 'موزعونا المعتمدون'],
  ])('renders %s', (path, title) => {
    renderApp(path)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  })

  it('renders the not-found page for unknown paths', () => {
    renderApp('/no-such-page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('الصفحة غير موجودة')
    expect(screen.getByRole('link', { name: 'رجوع للرئيسية' })).toHaveAttribute('href', '/')
  })
})
