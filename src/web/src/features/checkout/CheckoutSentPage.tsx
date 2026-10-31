import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { lastOrder } from '@/lib/browser'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/**
 * Shown after WhatsApp was opened. It says plainly that the order counts only once the customer
 * presses Send in WhatsApp, and lets them reopen the prepared message.
 */
export function CheckoutSentPage() {
  const { t } = useTranslation()
  const [order] = useState(lastOrder.load)
  useDocumentTitle(t('checkout.sent.title'))

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Icon className="size-8" name="check" />
      </span>
      <h1 className="mt-5 text-2xl font-black sm:text-3xl">{t('checkout.sent.title')}</h1>

      {order ? (
        <>
          <p className="mt-5 text-sm text-stone-500">{t('checkout.sent.reference')}</p>
          <p className="mt-1 text-2xl font-black tracking-wider text-orange-700">
            <bdi dir="ltr">{order.reference}</bdi>
          </p>
          <p className="mx-auto mt-5 max-w-md leading-7 text-stone-600">{t('checkout.sent.text')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a className={buttonClasses('whatsapp')} href={order.whatsAppUrl}>
              <Icon className="size-5" name="whatsapp" /> {t('checkout.sent.reopen')}
            </a>
            <ButtonLink to="/" variant="secondary">
              {t('checkout.sent.home')}
            </ButtonLink>
          </div>
        </>
      ) : (
        <>
          <p className="mx-auto mt-5 max-w-md leading-7 text-stone-600">{t('checkout.sent.missing')}</p>
          <ButtonLink className="mt-8" to="/">
            {t('checkout.sent.home')}
          </ButtonLink>
        </>
      )}
    </section>
  )
}
