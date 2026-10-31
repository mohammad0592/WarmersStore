import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { ForwardChevron, Icon } from '@/components/ui/Icon'
import { EmptyState, MediaImage } from '@/components/ui/Sections'
import { ErrorState } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import type { Product } from '@/lib/api/types'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { productSpecRows } from './productSpecs'
import { productQuery } from './queries'

export function ProductDetailsPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const product = useQuery(productQuery(slug))
  useDocumentTitle(product.data?.name ?? t('pages.products.title'))

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link className="mb-6 inline-flex items-center gap-1 text-sm font-bold text-stone-600 hover:text-orange-700" to="/products">
        <Icon className="size-4" name="chevron" /> {t('product.allProducts')}
      </Link>

      {product.isPending ? (
        <div aria-busy="true" aria-label={t('common.loading')} className="grid gap-8 md:grid-cols-2" role="status">
          <div className="aspect-square animate-pulse rounded-[2rem] bg-orange-50" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-full bg-stone-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-stone-100" />
          </div>
        </div>
      ) : product.isError ? (
        product.error instanceof ApiError && product.error.status === 404 ? (
          <EmptyState icon="info" text={t('product.notFound')}>
            <ButtonLink to="/products">{t('product.allProducts')}</ButtonLink>
          </EmptyState>
        ) : (
          <ErrorState onRetry={() => void product.refetch()} />
        )
      ) : (
        <ProductDetails key={product.data.id} product={product.data} />
      )}
    </section>
  )
}

function ProductDetails({ product }: { product: Product }) {
  const { t } = useTranslation()
  const [imageIndex, setImageIndex] = useState(0)
  const image = product.images[imageIndex] ?? product.images[0]

  return (
    <article className="grid items-start gap-8 overflow-hidden rounded-[2rem] border border-stone-200 bg-white md:grid-cols-2">
      <div>
        <MediaImage alt={image?.alt ?? product.name} className="aspect-square" src={image?.url} />
        {product.images.length > 1 && (
          <div className="flex gap-2 p-4">
            {product.images.map((img, index) => (
              <button
                aria-label={t('product.photo', { index: index + 1, name: product.name })}
                aria-pressed={index === imageIndex}
                className={`size-16 overflow-hidden rounded-xl border-2 ${index === imageIndex ? 'border-orange-500' : 'border-transparent'}`}
                key={img.url}
                onClick={() => setImageIndex(index)}
                type="button"
              >
                <img alt="" className="size-full object-cover" src={img.url} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 sm:p-8">
        <span className="text-xs font-extrabold text-orange-700">{t('product.airActivated')}</span>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{product.name}</h1>
        {(product.description ?? product.shortDescription) && (
          <p className="mt-4 whitespace-pre-line leading-7 text-stone-600">{product.description ?? product.shortDescription}</p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          {productSpecRows(product, t).map((row) => (
            <div className="rounded-2xl bg-stone-50 p-3" key={row.label}>
              <dt className="text-xs text-stone-500">{row.label}</dt>
              <dd className="mt-1 font-extrabold">{row.value}</dd>
            </div>
          ))}
        </dl>

        {(product.usageGuidance || product.safetyInfo) && (
          <div className="mt-6 space-y-4">
            {product.usageGuidance && (
              <div>
                <h2 className="flex items-center gap-2 font-extrabold">
                  <Icon className="size-5 text-orange-600" name="spark" /> {t('product.usage')}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-600">{product.usageGuidance}</p>
              </div>
            )}
            {product.safetyInfo && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="flex items-center gap-2 font-extrabold text-amber-900">
                  <Icon className="size-5" name="info" /> {t('product.safety')}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-amber-900/80">{product.safetyInfo}</p>
              </div>
            )}
          </div>
        )}

        <ButtonLink className="mt-6 w-full" to="/packages">
          {t('product.viewPackages')} <ForwardChevron />
        </ButtonLink>
      </div>
    </article>
  )
}
