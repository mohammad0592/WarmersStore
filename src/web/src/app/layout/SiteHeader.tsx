import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { CartButton } from '@/features/cart/CartButton'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import { BrandMark } from './BrandMark'
import { mainNavigation } from './navigation'

export function SiteHeader() {
  const { t } = useTranslation()
  const { data: settings } = useStoreSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  const items = mainNavigation(settings?.showDistributors ?? false)

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandMark />

        <nav aria-label={t('nav.main')} className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `rounded-xl px-4 py-2 text-sm font-bold transition ${
                  isActive ? 'bg-orange-50 text-orange-700' : 'text-stone-600 hover:text-orange-700'
                }`
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <CartButton />
          <button
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            className="grid size-11 place-items-center rounded-xl border border-stone-200 bg-white md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <Icon className="size-5" name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav aria-label={t('nav.main')} className="grid gap-1 border-t border-orange-100 bg-white p-3 md:hidden" id="mobile-menu">
          {items.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `rounded-xl px-4 py-3 text-sm font-bold ${
                  isActive ? 'bg-orange-50 text-orange-700' : 'text-stone-700 hover:bg-orange-50'
                }`
              }
              end={item.end}
              key={item.to}
              onClick={() => setMenuOpen(false)}
              to={item.to}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
