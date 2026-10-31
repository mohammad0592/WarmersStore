import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('routes', () => {
  it('renders the Arabic home page', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('خليك دافي وين ما كنت')
  })

  it('renders the not-found page for unknown paths', () => {
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('الصفحة غير موجودة')
    expect(screen.getByRole('link', { name: 'رجوع للرئيسية' })).toHaveAttribute('href', '/')
  })
})
