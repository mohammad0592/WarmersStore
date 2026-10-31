import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MediaImage } from '@/components/ui/Sections'
import { ErrorState } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import type { Product } from '@/lib/api/types'
import { useDialog } from '@/lib/useDialog'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { productSpecRows } from './productSpecs'
import { productQuery, productsQuery } from './queries'

/**
 * Product details as the design's modal, opened over the catalog at /products/:slug (so a product
 * can still be linked to and shared). A bottom sheet on phones, a centred dialog on larger screens.
 */
export function ProductDetailsDialog() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const panel = useRef<HTMLDivElement>(null)

  // Opening from the list shows the card's data at once while the full record loads.
  const product = useQuery({
    ...productQuery(slug),
    placeholderData: () => queryClient.getQueryData(productsQuery.queryKey)?.find((p) => p.slug === slug),
  })

  const close = useCallback(() => navigate('/products', { preventScrollReset: true }), [navigate])
  useDialog(true, close, panel)
  useDocumentTitle(product.data?.name ?? t('pages.products.title'))

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-stone-950/50 backdrop-blur-sm sm:place-items-center sm:p-5">
      <button aria-label={t('product.close')} className="absolute inset-0 size-full cursor-default" onClick={close} tabIndex={-1} type="button" />
      <div
        aria-labelledby="product-dialog-title"
        aria-modal="true"
        className="relative max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]"
        ref={panel}
        role="dialog"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white/95 px-5 py-4 backdrop-blur">
          <strong className="text-lg" id="product-dialog-title">
            {t('product.dialogTitle')}
          </strong>
          <button aria-label={t('product.close')} className="grid size-10 place-items-center rounded-xl bg-stone-100 hover:bg-stone-200" onClick={close} type="button">
            <Icon className="size-5" name="close" />
          </button>
        </div>

        {product.data ? (
          <Details key={product.data.id} product={product.data} />
        ) : product.isError ? (
          <div className="p-8">
            {product.error instanceof ApiError && product.error.status === 404 ? (
              <p className="text-center font-bold text-stone-600">{t('product.notFound')}</p>
            ) : (
              <ErrorState onRetry={() => void product.refetch()} />
            )}
          </div>
        ) : (
          <div aria-busy="true" className="grid gap-6 p-6 md:grid-cols-2" role="status">
            <div className="space-y-4">
              <div className="h-8 w-2/3 animate-pulse rounded-full bg-stone-200" />
              <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-stone-100" />
            </div>
            <div className="min-h-80 animate-pulse rounded-2xl bg-orange-50" />
          </div>
        )}
      </div>
    </div>
  )
}

function Details({ product }: { product: Product }) {
  const { t } = useTranslation()
  const [imageIndex, setImageIndex] = useState(0)
  const image = product.images[imageIndex] ?? product.images[0]
  const description = product.description ?? product.shortDescription

  return (
    <div className="grid md:grid-cols-2">
      {/* Details first: in right-to-left layout they sit on the right, the photo on the left. */}
      <div className="p-6 sm:p-8">
        <span className="text-xs font-extrabold text-orange-700">{t('product.airActivated')}</span>
        <h2 className="mt-2 text-3xl font-black">{product.name}</h2>
        {description && <p className="mt-4 whitespace-pre-line leading-7 text-stone-600">{description}</p>}

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
                <h3 className="flex items-center gap-2 font-extrabold">
                  <Icon className="size-5 text-orange-600" name="spark" /> {t('product.usage')}
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-600">{product.usageGuidance}</p>
              </div>
            )}
            {product.safetyInfo && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="flex items-center gap-2 font-extrabold text-amber-900">
                  <Icon className="size-5" name="info" /> {t('product.safety')}
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-amber-900/80">{product.safetyInfo}</p>
              </div>
            )}
          </div>
        )}

        <ButtonLink className="mt-6 w-full" to="/packages">
          {t('product.viewPackages')}
        </ButtonLink>
      </div>

      <div className="flex flex-col bg-orange-50 max-md:order-first">
        <MediaImage alt={image?.alt ?? product.name} className="min-h-72 flex-1 md:min-h-full" src={image?.url} />
        {product.images.length > 1 && (
          <div className="flex gap-2 bg-white p-3">
            {product.images.map((img, index) => (
              <button
                aria-label={t('product.photo', { index: index + 1, name: product.name })}
                aria-pressed={index === imageIndex}
                className={`size-14 overflow-hidden rounded-xl border-2 ${index === imageIndex ? 'border-orange-500' : 'border-transparent'}`}
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
    </div>
  )
}
