import { useTranslation } from 'react-i18next'

export function HomePage() {
  const { t } = useTranslation()

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-warm px-4 py-16 text-center">
      <span className="rounded-2xl bg-brand-600 px-4 py-2 text-xl font-black text-white">{t('brand.name')}</span>
      <h1 className="text-4xl font-black leading-tight sm:text-6xl">{t('home.title')}</h1>
      <p className="max-w-md text-lg text-muted">{t('home.comingSoon')}</p>
    </section>
  )
}
