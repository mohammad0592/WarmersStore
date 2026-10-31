import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { EmptyState, PageHero } from '@/components/ui/Sections'
import { CardGridSkeleton, ErrorState } from '@/components/ui/States'
import type { Distributor } from '@/lib/api/types'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { CityFilter } from './CityFilter'
import { DistributorCard } from './DistributorCard'
import { citiesQuery, distributorsQuery } from './queries'

/**
 * Directory of authorized shops for buying in person. Deliberately independent of the cart,
 * checkout and delivery: nothing here can be ordered (enforced by a lint rule on this folder).
 */
export function DistributorsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const selectedCity = searchParams.get('city')
  const cities = useQuery(citiesQuery)
  const distributors = useQuery(distributorsQuery)
  useDocumentTitle(t('pages.distributors.title'))

  const isPending = cities.isPending || distributors.isPending
  const isError = cities.isError || distributors.isError
  const retry = () => {
    void cities.refetch()
    void distributors.refetch()
  }

  return (
    <>
      <PageHero eyebrow={t('pages.distributors.eyebrow')} text={t('distributors.intro')} title={t('pages.distributors.title')} />

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <p
          className="mb-8 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold leading-7 text-orange-900 sm:items-center sm:text-base"
          role="note"
        >
          <Icon className="mt-1 size-5 shrink-0 text-orange-600 sm:mt-0" name="info" />
          {t('distributors.inStoreOnly')}
        </p>

        {isPending ? (
          <CardGridSkeleton className="sm:grid-cols-2 lg:grid-cols-3" count={3} />
        ) : isError ? (
          <ErrorState onRetry={retry} />
        ) : distributors.data!.length === 0 ? (
          <EmptyState icon="map-pin" text={t('distributors.emptyAll')}>
            <ButtonLink to="/packages" variant="secondary">
              {t('distributors.orderOnline')}
            </ButtonLink>
          </EmptyState>
        ) : (
          <>
            <div className="mb-8">
              <CityFilter cities={cities.data!} selected={selectedCity} total={distributors.data!.length} />
            </div>
            <DistributorList distributors={distributors.data!} selectedCity={selectedCity} />
          </>
        )}
      </section>
    </>
  )
}

function DistributorList({ distributors, selectedCity }: { distributors: Distributor[]; selectedCity: string | null }) {
  const { t } = useTranslation()
  const visible = selectedCity ? distributors.filter((d) => d.city.slug === selectedCity) : distributors

  if (visible.length === 0) {
    return (
      <EmptyState icon="map-pin" text={t('distributors.emptyCity')}>
        <ButtonLink replace to="/distributors">
          {t('distributors.showAll')}
        </ButtonLink>
        <ButtonLink to="/packages" variant="secondary">
          {t('distributors.orderOnline')}
        </ButtonLink>
      </EmptyState>
    )
  }

  // The API orders by city, so consecutive runs form the groups.
  const groups: { city: Distributor['city']; items: Distributor[] }[] = []
  for (const distributor of visible) {
    const last = groups.at(-1)
    if (last?.city.id === distributor.city.id) last.items.push(distributor)
    else groups.push({ city: distributor.city, items: [distributor] })
  }

  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <section aria-labelledby={`city-${group.city.id}`} key={group.city.id}>
          <h2 className="mb-5 flex items-center gap-2 text-2xl font-black" id={`city-${group.city.id}`}>
            <Icon className="size-6 text-orange-600" name="map-pin" /> {group.city.name}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((distributor) => (
              <DistributorCard distributor={distributor} key={distributor.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
