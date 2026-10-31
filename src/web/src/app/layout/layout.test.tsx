import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/renderApp'

const mainNav = () => screen.getAllByRole('navigation', { name: 'التنقل الرئيسي' })[0]

describe('site header', () => {
  it('shows the main links and marks the current page', () => {
    renderApp('/packages')

    const nav = mainNav()
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['الرئيسية', 'المنتجات', 'الباقات'])
    expect(within(nav).getByRole('link', { name: 'الباقات' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the distributors link only when the admin enables it', () => {
    renderApp('/', { showDistributors: true })

    expect(within(mainNav()).getByRole('link', { name: 'موزعونا المعتمدون' })).toHaveAttribute('href', '/distributors')
  })

  it('uses the store name from settings', () => {
    renderApp('/', { storeName: 'متجر تجريبي' })

    expect(screen.getAllByText('متجر تجريبي').length).toBeGreaterThan(0)
  })

  it('opens and closes the mobile menu, including with Escape and after navigating', async () => {
    const { router } = renderApp('/')
    const toggle = screen.getByRole('button', { name: 'فتح القائمة' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'إغلاق القائمة' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.getElementById('mobile-menu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'فتح القائمة' }))
    fireEvent.click(within(document.getElementById('mobile-menu')!).getByRole('link', { name: 'المنتجات' }))
    expect(document.getElementById('mobile-menu')).toBeNull()
    expect(router.state.location.pathname).toBe('/products')
  })
})

describe('announcement bar', () => {
  it('is hidden without an announcement', () => {
    renderApp('/')
    expect(screen.queryByText('عرض الشتاء')).toBeNull()
  })

  it('shows the active announcement', () => {
    renderApp('/', { announcement: 'عرض الشتاء' })
    expect(screen.getByText('عرض الشتاء')).toBeInTheDocument()
  })
})

describe('site footer', () => {
  it('omits contact links that are not configured', () => {
    renderApp('/')

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).queryByText('واتساب المتجر')).toBeNull()
    expect(within(footer).queryByRole('list', { name: 'تابعنا' })).toBeNull()
  })

  it('links WhatsApp, phone and social profiles when configured', () => {
    renderApp('/', {
      whatsAppNumber: '+970599000000',
      phone: '+970 9 000 0000',
      social: { facebook: 'https://facebook.com/example', instagram: null, tikTok: null },
    })

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: /واتساب المتجر/ })).toHaveAttribute('href', 'https://wa.me/970599000000')
    expect(within(footer).getByRole('link', { name: /الهاتف/ })).toHaveAttribute('href', 'tel:+970 9 000 0000')
    expect(within(footer).getByRole('link', { name: 'فيسبوك' })).toHaveAttribute('href', 'https://facebook.com/example')
  })
})
