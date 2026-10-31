import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ForwardChevron, Icon } from '@/components/ui/Icon'
import { MediaImage } from '@/components/ui/Sections'
import type { Product } from '@/lib/api/types'
import { formatDimensions, formatHours, formatPieces } from '@/lib/format'
import { adhesiveLabel } from './productSpecs'

export function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const hours = formatHours(product.heatMinHours, product.heatMaxHours)
  const adhesive = adhesiveLabel(product, t)

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <MediaImage alt={product.images[0]?.alt ?? product.name} className="aspect-[4/3]" src={product.images[0]?.url} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {hours && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800">
              <Icon className="size-3" name="clock" />
              {hours}
            </span>
          )}
          {adhesive && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">{adhesive}</span>
          )}
        </div>
        <h3 className="text-lg font-black">
          {/* The whole card is clickable through this link's overlay. */}
          <Link className="after:absolute after:inset-0" preventScrollReset to={`/products/${product.slug}`}>
            {product.name}
          </Link>
        </h3>
        {product.shortDescription && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{product.shortDescription}</p>
        )}
        <p className="mt-3 text-xs font-semibold text-stone-500">
          {formatDimensions(product.widthCm, product.heightCm)} · {t('product.bagContains', { pieces: formatPieces(product.piecesPerRetailBag) })}
        </p>
        <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-extrabold text-orange-700">
          {t('product.details')} <ForwardChevron />
        </span>
      </div>
    </article>
  )
}
