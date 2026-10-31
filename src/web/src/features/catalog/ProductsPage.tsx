import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Outlet, useParams } from 'react-router'
import { TrustSection } from '@/components/TrustSection'
import { EmptyState, PageHero } from '@/components/ui/Sections'
import { CardGridSkeleton, ErrorState } from '@/components/ui/States'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ProductCard } from './ProductCard'
import { productsQuery } from './queries'

export function ProductsPage() {
  const { t } = useTranslation()
  const products = useQuery(productsQuery)
  const { slug } = useParams()
  useDocumentTitle(t('pages.products.title'), !slug) // the details dialog sets the product's name

  return (
    <>
      <PageHero eyebrow={t('pages.products.eyebrow')} text={t('pages.products.text')} title={t('pages.products.title')} />
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        {products.isPending ? (
          <CardGridSkeleton />
        ) : products.isError ? (
          <ErrorState onRetry={() => void products.refetch()} />
        ) : products.data.length === 0 ? (
          <EmptyState text={t('product.empty')} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
      <TrustSection />
      <Outlet />
    </>
  )
}
