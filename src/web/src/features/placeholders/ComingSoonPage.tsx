import { useTranslation } from 'react-i18next'
import { EmptyState, PageHero } from '@/components/ui/Sections'

type PageKey = 'products' | 'packages' | 'distributors'

/** Stand-in so navigation works before each page is built (products/packages: M4, distributors: M5). */
export function ComingSoonPage({ page }: { page: PageKey }) {
  const { t } = useTranslation()

  return (
    <>
      <PageHero eyebrow={t(`pages.${page}.eyebrow`)} text={t(`pages.${page}.text`)} title={t(`pages.${page}.title`)} />
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <EmptyState text={t('common.comingSoonText')} />
      </section>
    </>
  )
}
