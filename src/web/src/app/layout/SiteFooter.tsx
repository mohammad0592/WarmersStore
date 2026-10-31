import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import { whatsAppChatUrl } from '@/lib/format'
import { BrandMark } from './BrandMark'

const currentYear = new Date().getFullYear()

export function SiteFooter() {
  const { t } = useTranslation()
  const { data: settings } = useStoreSettings()
  const whatsApp = whatsAppChatUrl(settings?.whatsAppNumber)
  const social = [
    { href: settings?.social.facebook, label: t('footer.facebook') },
    { href: settings?.social.instagram, label: t('footer.instagram') },
    { href: settings?.social.tikTok, label: t('footer.tiktok') },
  ].filter((link): link is { href: string; label: string } => !!link.href)

  return (
    <footer className="mt-20 bg-stone-950 text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <div className="mb-4">
            <BrandMark tone="light" />
          </div>
          <p className="max-w-sm text-sm leading-7 text-stone-400">{t('brand.tagline')}</p>
        </div>

        <div>
          <h2 className="mb-4 font-bold text-white">{t('footer.quickLinks')}</h2>
          <ul className="grid gap-3 text-sm">
            <li>
              <Link className="hover:text-white" to="/products">{t('nav.products')}</Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/packages">{t('footer.readyPackages')}</Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/packages#custom">{t('footer.customPackage')}</Link>
            </li>
            {settings?.showDistributors && (
              <li>
                <Link className="hover:text-white" to="/distributors">{t('nav.distributors')}</Link>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 font-bold text-white">{t('footer.contactTitle')}</h2>
          <p className="mb-4 text-sm text-stone-400">{t('footer.contactText')}</p>
          <div className="grid gap-3 text-sm">
            {whatsApp && (
              <a className="inline-flex items-center gap-2 font-bold text-emerald-400 hover:text-emerald-300" href={whatsApp} rel="noreferrer" target="_blank">
                <Icon className="size-5" name="whatsapp" /> {t('footer.whatsapp')}
              </a>
            )}
            {settings?.phone && (
              <a className="inline-flex items-center gap-2 hover:text-white" href={`tel:${settings.phone}`}>
                <Icon className="size-5" name="phone" />
                <span className="sr-only">{t('footer.phone')}: </span>
                <bdi dir="ltr">{settings.phone}</bdi>
              </a>
            )}
            {settings?.email && (
              <a className="hover:text-white" href={`mailto:${settings.email}`}>
                <span className="sr-only">{t('footer.email')}: </span>
                <bdi dir="ltr">{settings.email}</bdi>
              </a>
            )}
            {settings?.address && <p className="text-stone-400">{settings.address}</p>}
            {social.length > 0 && (
              <ul aria-label={t('footer.social')} className="flex flex-wrap gap-4 pt-1">
                {social.map((link) => (
                  <li key={link.label}>
                    <a className="hover:text-white" href={link.href} rel="noreferrer" target="_blank">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-stone-800 px-4 py-5 text-center text-xs text-stone-500">
        {t('footer.rights', { year: currentYear, store: settings?.storeName ?? t('brand.name') })}
      </div>
    </footer>
  )
}
