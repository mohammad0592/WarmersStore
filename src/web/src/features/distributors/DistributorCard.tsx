import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { MediaImage } from '@/components/ui/Sections'
import { buttonClasses } from '@/components/ui/buttonStyles'
import type { Distributor } from '@/lib/api/types'
import { safeExternalUrl } from '@/lib/format'

/**
 * An authorized shop. The only actions are opening the shop's location in Google Maps and,
 * when listed, calling it: purchases happen in person, so there is nothing to order here.
 */
export function DistributorCard({ distributor }: { distributor: Distributor }) {
  const { t } = useTranslation()
  const mapUrl = safeExternalUrl(distributor.mapUrl)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <MediaImage alt={distributor.name} className="aspect-[16/9]" fallbackIcon="map-pin" src={distributor.imageUrl} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-extrabold text-orange-800">
            <Icon className="size-3.5" name="shield" /> {t('distributors.authorized')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
            <Icon className="size-3.5" name="map-pin" /> {distributor.city.name}
          </span>
        </div>

        <h3 className="text-lg font-black">{distributor.name}</h3>

        <dl className="mt-3 space-y-2 text-sm text-stone-600">
          <div className="flex gap-2">
            <dt className="sr-only">{t('distributors.address')}</dt>
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-stone-400" name="map-pin" />
            <dd className="leading-6">{distributor.address}</dd>
          </div>
          {distributor.phone && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">{t('distributors.phone')}</dt>
              <Icon aria-hidden="true" className="size-4 shrink-0 text-stone-400" name="phone" />
              <dd>
                <a className="font-bold text-stone-800 hover:text-orange-700" href={`tel:${distributor.phone}`}>
                  <bdi dir="ltr">{distributor.phone}</bdi>
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-auto pt-5">
          {mapUrl ? (
            <a className={buttonClasses('primary', 'w-full')} href={mapUrl} rel="noopener noreferrer" target="_blank">
              <Icon className="size-5" name="map-pin" /> {t('distributors.showOnMap')}
              <span className="sr-only"> {t('distributors.opensInNewTab')}</span>
            </a>
          ) : (
            <p className="rounded-xl bg-stone-50 px-4 py-3 text-center text-sm font-bold text-stone-500">
              {t('distributors.mapUnavailable')}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
