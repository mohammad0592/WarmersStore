import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TrustSection } from '@/components/TrustSection'
import { ButtonLink } from '@/components/ui/Button'
import { ForwardChevron, Icon } from '@/components/ui/Icon'
import { MediaImage, SectionTitle } from '@/components/ui/Sections'
import { CardGridSkeleton } from '@/components/ui/States'
import { ProductCard } from '@/features/catalog/ProductCard'
import { packagesQuery, productsQuery } from '@/features/catalog/queries'
import { AddToCartControls } from '@/features/packages/AddToCartControls'
import { PackageCard } from '@/features/packages/PackageCard'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import type { ReadyMadePackage } from '@/lib/api/types'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/** Featured packages first; if none are marked featured, the first three. */
function homePackages(packages: ReadyMadePackage[]) {
  const featured = packages.filter((item) => item.isFeatured)
  return (featured.length > 0 ? featured : packages).slice(0, 3)
}

export function HomePage() {
  const { t } = useTranslation()
  const { data: settings } = useStoreSettings()
  const products = useQuery(productsQuery)
  const packages = useQuery(packagesQuery)
  useDocumentTitle()

  const featured = homePackages(packages.data ?? [])
  const heroImage =
    featured.find((item) => item.imageUrl)?.imageUrl ?? products.data?.find((p) => p.images.length > 0)?.images[0].url

  return (
    <>
      <Hero imageUrl={heroImage} />
      <PurchaseOptions />
      <OrderingSteps />

      {products.isPending ? (
        <HomeSection eyebrowKey="home.products.eyebrow" titleKey="home.products.title">
          <CardGridSkeleton />
        </HomeSection>
      ) : (
        !!products.data?.length && (
          <HomeSection eyebrowKey="home.products.eyebrow" titleKey="home.products.title">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.data.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </HomeSection>
        )
      )}

      {featured.length > 0 && (
        <HomeSection eyebrowKey="home.packages.eyebrow" titleKey="home.packages.title">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((item) => (
              <PackageCard actions={<AddToCartControls item={item} />} item={item} key={item.id} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <ButtonLink to="/packages" variant="secondary">
              {t('home.packages.all')} <ForwardChevron />
            </ButtonLink>
          </div>
        </HomeSection>
      )}

      {settings?.showDistributors && <WhereToFindUs />}
      <TrustSection />
    </>
  )
}

function HomeSection({
  eyebrowKey,
  titleKey,
  children,
}: {
  eyebrowKey: 'home.products.eyebrow' | 'home.packages.eyebrow'
  titleKey: 'home.products.title' | 'home.packages.title'
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <SectionTitle eyebrow={t(eyebrowKey)} title={t(titleKey)} />
      {children}
    </section>
  )
}

function Hero({ imageUrl }: { imageUrl: string | undefined }) {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden bg-sand">
      <div aria-hidden="true" className="absolute -right-28 top-20 size-72 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 md:min-h-[620px] md:grid-cols-2 md:py-20">
        <div className="relative z-10">
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
        <div className="relative mx-auto w-full max-w-lg">
          <div aria-hidden="true" className="absolute -inset-5 rotate-3 rounded-[3rem] bg-orange-200/50" />
          <MediaImage alt={t('home.heroImageAlt')} className="aspect-[4/5] rounded-[2.5rem] shadow-2xl" src={imageUrl} />
          <div className="absolute -bottom-4 -right-2 max-w-[230px] rounded-2xl border border-orange-100 bg-white p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
                <Icon className="size-5" name="flame" />
              </span>
              <div>
                <strong className="block text-sm">{t('home.airActivatedTitle')}</strong>
                <span className="text-xs text-stone-500">{t('home.airActivatedText')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PurchaseOptions() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <SectionTitle eyebrow={t('home.options.eyebrow')} text={t('home.options.text')} title={t('home.options.title')} />
      <div className="grid gap-5 md:grid-cols-2">
        <Link
          className="group relative overflow-hidden rounded-3xl border border-orange-100 bg-orange-50 p-7 transition hover:-translate-y-1 hover:shadow-xl"
          to="/packages"
        >
          <span className="mb-8 grid size-14 place-items-center rounded-2xl bg-orange-600 text-white">
            <Icon className="size-7" name="package" />
          </span>
          <h3 className="text-2xl font-black">{t('home.options.readyTitle')}</h3>
          <p className="mt-3 max-w-md leading-7 text-stone-600">{t('home.options.readyText')}</p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-extrabold text-orange-700">
            {t('home.options.readyCta')} <ForwardChevron />
          </span>
        </Link>
        <Link
          className="group relative overflow-hidden rounded-3xl border border-stone-200 bg-stone-900 p-7 text-white transition hover:-translate-y-1 hover:shadow-xl"
          to="/packages#custom"
        >
          <span className="mb-8 grid size-14 place-items-center rounded-2xl bg-white/10 text-orange-300">
            <Icon className="size-7" name="spark" />
          </span>
          <h3 className="text-2xl font-black">{t('home.options.customTitle')}</h3>
          <p className="mt-3 max-w-md leading-7 text-stone-300">{t('home.options.customText')}</p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-extrabold text-orange-300">
            {t('home.options.customCta')} <ForwardChevron />
          </span>
        </Link>
      </div>
    </section>
  )
}

function OrderingSteps() {
  const { t } = useTranslation()
  const steps = [
    { title: t('home.steps.choose'), text: t('home.steps.simpleText') },
    { title: t('home.steps.addToCart'), text: t('home.steps.simpleText') },
    { title: t('home.steps.delivery'), text: t('home.steps.simpleText') },
    { title: t('home.steps.send'), text: t('home.steps.sendText') },
  ]

  return (
    <section className="bg-stone-950 py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-3 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold text-orange-800">
            {t('home.steps.eyebrow')}
          </span>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t('home.steps.title')}</h2>
        </div>
        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="mb-4 grid size-11 place-items-center rounded-full border border-orange-400/40 bg-orange-500/10 text-lg font-black text-orange-300">
                {index + 1}
              </span>
              <h3 className="font-extrabold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 flex items-center justify-center gap-2 rounded-2xl bg-white/5 p-4 text-center text-sm font-bold text-orange-200">
          <Icon className="size-5 shrink-0" name="shield" /> {t('home.steps.cod')}
        </p>
      </div>
    </section>
  )
}

/**
 * The two ways to buy, kept visibly separate: online with our delivery, or in person at an
 * authorized shop with no delivery. New section; matches the design's card language.
 */
function WhereToFindUs() {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="where-to-find-us" className="bg-sand py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl" id="where-to-find-us">
            {t('home.whereToFind.title')}
          </h2>
          <p className="mt-4 leading-7 text-stone-600">{t('home.whereToFind.text')}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col rounded-3xl border border-orange-100 bg-white p-7 shadow-sm">
            <span className="mb-6 grid size-14 place-items-center rounded-2xl bg-orange-600 text-white">
              <Icon className="size-7" name="truck" />
            </span>
            <h3 className="text-2xl font-black">{t('home.whereToFind.onlineTitle')}</h3>
            <p className="mt-3 leading-7 text-stone-600">{t('home.whereToFind.onlineText')}</p>
            <div className="mt-auto pt-6">
              <ButtonLink to="/packages">
                {t('home.whereToFind.onlineCta')} <ForwardChevron />
              </ButtonLink>
            </div>
          </div>
          <div className="flex flex-col rounded-3xl border border-stone-200 bg-stone-900 p-7 text-white">
            <span className="mb-6 grid size-14 place-items-center rounded-2xl bg-white/10 text-orange-300">
              <Icon className="size-7" name="map-pin" />
            </span>
            <h3 className="text-2xl font-black">{t('home.whereToFind.storeTitle')}</h3>
            <p className="mt-3 leading-7 text-stone-300">{t('home.whereToFind.storeText')}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-200">
              <Icon className="size-4 shrink-0" name="info" /> {t('home.whereToFind.storeNote')}
            </p>
            <div className="mt-auto pt-6">
              <ButtonLink to="/distributors" variant="light">
                {t('home.whereToFind.storeCta')} <ForwardChevron />
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
