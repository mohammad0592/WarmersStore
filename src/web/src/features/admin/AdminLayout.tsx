import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import { adminKeys, adminRequest, meQuery } from './adminApi'

/** Sections appear here as their management pages are built (M9–M11). */
const sections: { to: string; labelKey: 'admin.nav.dashboard' | 'admin.nav.products' | 'admin.nav.packages'; icon: IconName; end?: boolean }[] = [
  { to: '/admin', labelKey: 'admin.nav.dashboard', icon: 'info', end: true },
  { to: '/admin/products', labelKey: 'admin.nav.products', icon: 'flame' },
  { to: '/admin/packages', labelKey: 'admin.nav.packages', icon: 'package' },
]

export function AdminLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: me } = useQuery(meQuery)
  const { data: settings } = useStoreSettings()

  const logout = useMutation({
    mutationFn: () => adminRequest<void>('POST', '/api/admin/auth/logout'),
    onSettled: () => {
      queryClient.removeQueries({ queryKey: adminKeys.all })
      navigate('/admin/login', { replace: true })
    },
  })

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link className="flex items-center gap-2" to="/admin">
            <span className="grid size-9 place-items-center rounded-xl bg-orange-600 text-white">
              <Icon className="size-5" name="flame" />
            </span>
            <span className="font-black">{t('admin.brand', { store: settings?.storeName ?? t('brand.name') })}</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-stone-500 sm:inline">
              <bdi dir="ltr">{me?.email}</bdi>
            </span>
            <Link className="rounded-lg px-3 py-2 font-bold text-stone-600 hover:bg-stone-100" target="_blank" to="/">
              {t('admin.viewStore')}
            </Link>
            <button
              className="rounded-lg px-3 py-2 font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              type="button"
            >
              {t('admin.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label={t('admin.nav.label')} className="lg:sticky lg:top-22 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col">
            {sections.map((section) => (
              <li className="shrink-0" key={section.to}>
                <NavLink
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                      isActive ? 'bg-orange-600 text-white' : 'bg-white text-stone-700 hover:bg-orange-50'
                    }`
                  }
                  end={section.end}
                  to={section.to}
                >
                  <Icon className="size-4" name={section.icon} /> {t(section.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
