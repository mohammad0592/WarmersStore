import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Sections'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-20">
      <h1 className="mb-6 text-center text-3xl font-black">{t('notFound.title')}</h1>
      <EmptyState icon="info" text={t('notFound.description')}>
        <ButtonLink to="/">{t('notFound.backHome')}</ButtonLink>
      </EmptyState>
    </section>
  )
}
