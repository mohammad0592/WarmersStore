import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { EmptyState, PageHero, SectionTitle } from '@/components/ui/Sections'
import { CardGridSkeleton, ErrorState } from '@/components/ui/States'
import { packagesQuery } from '@/features/catalog/queries'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { PackageCard } from './PackageCard'

export function PackagesPage() {
  const { t } = useTranslation()
  const packages = useQuery(packagesQuery)
  useDocumentTitle(t('pages.packages.title'))

  return (
    <>
      <PageHero eyebrow={t('pages.packages.eyebrow')} text={t('pages.packages.text')} title={t('pages.packages.title')} />

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <SectionTitle eyebrow={t('package.readyEyebrow')} text={t('package.readyText')} title={t('package.readyTitle')} />
        {packages.isPending ? (
          <CardGridSkeleton className="md:grid-cols-3" count={3} />
        ) : packages.isError ? (
          <ErrorState onRetry={() => void packages.refetch()} />
        ) : packages.data.length === 0 ? (
          <EmptyState text={t('package.empty')} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packages.data.map((item) => (
              <PackageCard item={item} key={item.id} />
            ))}
          </div>
        )}
      </section>

      {/* The custom package builder arrives with the cart (M6); the anchor already works for links. */}
      <section className="scroll-mt-24 bg-orange-50/70 py-20" id="custom">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle eyebrow={t('package.customEyebrow')} text={t('package.customText')} title={t('package.customTitle')} />
          <EmptyState icon="spark" text={t('common.comingSoonText')} />
        </div>
      </section>
    </>
  )
}
