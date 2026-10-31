import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-black">{t('notFound.title')}</h1>
      <p className="text-muted">{t('notFound.description')}</p>
      <Link
        to="/"
        className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {t('notFound.backHome')}
      </Link>
    </section>
  )
}
