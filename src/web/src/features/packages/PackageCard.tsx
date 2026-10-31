import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { MediaImage } from '@/components/ui/Sections'
import type { ReadyMadePackage } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { packageSavings } from './packageSavings'

/**
 * Ready-made package card from the design. `actions` holds the quantity selector and
 * add-to-cart button (see AddToCartControls).
 */
export function PackageCard({ item, actions }: { item: ReadyMadePackage; actions?: ReactNode }) {
  const { t } = useTranslation()
  const savings = packageSavings(item)
  const badge = !item.isAvailable
    ? t('package.unavailable')
    : savings
      ? t('package.save', { amount: formatMoney(savings) })
      : item.isFeatured
        ? t('package.featured')
        : null

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${item.isAvailable ? '' : 'opacity-75'}`}
    >
      <div className="relative">
        <MediaImage alt={item.name} className="aspect-[16/10]" src={item.imageUrl} />
        {badge && (
          <span
            className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-xs font-extrabold text-white ${item.isAvailable ? 'bg-stone-900' : 'bg-stone-500'}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-black">{item.name}</h3>
        {item.description && <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>}
        <ul aria-label={t('package.contents')} className="mt-5 space-y-2 border-y border-stone-100 py-4">
          {item.items.map((content) => (
            <li className="flex items-center gap-2 text-sm text-stone-700" key={content.productId}>
              <Icon className="size-4 shrink-0 text-orange-600" name="check" />
              {content.quantity} × {content.productName}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-5">
          <span className="text-xs text-stone-500">{t('package.price')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-orange-700">{formatMoney(item.price)}</span>
            {savings && <s className="text-sm text-stone-400">{formatMoney(item.regularPrice!)}</s>}
          </div>
          {actions}
        </div>
      </div>
    </article>
  )
}
