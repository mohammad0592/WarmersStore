import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { City } from '@/lib/api/types'

/**
 * City chips. Each chip is a link that sets ?city=<slug>, so a filtered list can be shared and
 * the browser's back button undoes a selection. Scrolls sideways on narrow screens.
 */
export function CityFilter({ cities, selected, total }: { cities: City[]; selected: string | null; total: number }) {
  const { t } = useTranslation()
  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition ${
      active ? 'border-orange-600 bg-orange-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300 hover:text-orange-700'
    }`
  const count = (n: number, active: boolean) => (
    <span className={`text-xs ${active ? 'text-orange-100' : 'text-stone-400'}`}>({n})</span>
  )

  return (
    <nav aria-label={t('distributors.filterLabel')} className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 sm:flex-wrap">
        <li>
          <Link aria-current={selected === null ? 'true' : undefined} className={chip(selected === null)} replace to="/distributors">
            {t('distributors.allCities')} {count(total, selected === null)}
          </Link>
        </li>
        {cities.map((city) => {
          const active = city.slug === selected
          return (
            <li key={city.id}>
              <Link
                aria-current={active ? 'true' : undefined}
                className={chip(active)}
                replace
                to={`/distributors?city=${encodeURIComponent(city.slug)}`}
              >
                {city.name} {count(city.distributorCount, active)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
