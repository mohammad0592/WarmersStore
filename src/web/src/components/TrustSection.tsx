import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import { whatsAppChatUrl } from '@/lib/format'

/**
 * The beige "how it works" panel with the orange WhatsApp panel beside it. The design's safety
 * bullet points are not reused: real safety guidance will come from the business, per product.
 * The WhatsApp panel only appears once the store number is configured.
 */
export function TrustSection() {
  const { t } = useTranslation()
  const { data: settings } = useStoreSettings()
  const whatsApp = whatsAppChatUrl(settings?.whatsAppNumber)

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <div className={`grid overflow-hidden rounded-[2rem] bg-cream ${whatsApp ? 'md:grid-cols-[1.2fr_.8fr]' : ''}`}>
        <div className="p-7 sm:p-10">
          <span className="text-xs font-extrabold text-orange-800">{t('home.trust.eyebrow')}</span>
          <h2 className="mt-3 text-3xl font-black">{t('home.trust.title')}</h2>
          <p className="mt-4 max-w-xl leading-7 text-stone-700">{t('home.trust.text')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl bg-white/70 p-4">
              <Icon className="size-6 shrink-0 text-orange-700" name="shield" />
              <span className="text-sm font-bold">{t('home.trust.cod')}</span>
            </div>
            <div className="flex gap-3 rounded-2xl bg-white/70 p-4">
              <Icon className="size-6 shrink-0 text-orange-700" name="check" />
              <span className="text-sm font-bold">{t('home.trust.noAccount')}</span>
            </div>
          </div>
        </div>
        {whatsApp && (
          <div className="flex flex-col justify-center bg-orange-600 p-7 text-white sm:p-10">
            <Icon className="mb-5 size-10" name="whatsapp" />
            <h2 className="text-2xl font-black">{t('home.trust.questionTitle')}</h2>
            <p className="mt-3 text-sm leading-7 text-orange-50">{t('home.trust.questionText')}</p>
            <a className={buttonClasses('light', 'mt-6')} href={whatsApp} rel="noreferrer" target="_blank">
              {t('home.trust.questionCta')}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
