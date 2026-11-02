import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { AppErrorPage } from './AppErrorPage'

function Broken(): never {
  throw new Error('chunk failed to load')
}

describe('unexpected errors', () => {
  it('shows an Arabic page with a reload button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <Broken />, errorElement: <AppErrorPage /> }])
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('صار خطأ غير متوقع')
    expect(screen.getByRole('button', { name: 'تحديث الصفحة' })).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('covers both the store and the admin', () => {
    expect(routes.every((route) => route.errorElement)).toBe(true)
  })
})
