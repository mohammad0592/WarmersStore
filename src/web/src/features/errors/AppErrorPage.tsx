import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Sections'

/** Replaces the router's default English error screen, e.g. when a tab left open across a deploy can't load a page. */
export function AppErrorPage() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-20">
      <h1 className="mb-6 text-center text-3xl font-black">{t('appError.title')}</h1>
      <EmptyState icon="info" text={t('appError.description')}>
        <Button onClick={() => window.location.reload()}>{t('appError.reload')}</Button>
      </EmptyState>
    </main>
  )
}
