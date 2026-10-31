import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { ForwardChevron, Icon } from '@/components/ui/Icon'

// Hero text block from the design; the image, sections and featured packages arrive in M4.
export function HomePage() {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden bg-sand">
      <div aria-hidden="true" className="absolute -right-28 top-20 size-72 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-bold text-orange-800 shadow-sm">
          <Icon className="size-4" name="spark" /> {t('home.badge')}
        </span>
        <h1 className="max-w-xl text-5xl font-black leading-[1.15] tracking-tight text-stone-950 sm:text-6xl lg:text-7xl">
          {t('home.title')}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">{t('home.description')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/packages">
            {t('home.shopPackages')} <ForwardChevron />
          </ButtonLink>
          <ButtonLink to="/products" variant="secondary">
            {t('home.exploreProducts')}
          </ButtonLink>
        </div>
        <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-stone-600">
          <span className="flex items-center gap-2">
            <Icon className="size-5 text-orange-600" name="truck" /> {t('home.homeDelivery')}
          </span>
          <span className="flex items-center gap-2">
            <Icon className="size-5 text-orange-600" name="shield" /> {t('home.cashOnDelivery')}
          </span>
        </div>
      </div>
    </section>
  )
}
