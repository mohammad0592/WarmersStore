import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration } from 'react-router'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import { SiteFooter } from './layout/SiteFooter'
import { SiteHeader } from './layout/SiteHeader'

export function RootLayout() {
  const { t } = useTranslation()
  const { data: settings } = useStoreSettings()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        className="fixed right-2 top-2 z-[100] -translate-y-[150%] rounded-lg bg-stone-900 px-3 py-2 text-sm font-bold text-white transition focus:translate-y-0"
        href="#main"
      >
        {t('nav.skipToContent')}
      </a>
      {settings?.announcement && (
        <div className="bg-stone-900 px-4 py-2 text-center text-xs font-semibold text-orange-50">{settings.announcement}</div>
      )}
      <SiteHeader />
      <main className="flex flex-1 flex-col" id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
