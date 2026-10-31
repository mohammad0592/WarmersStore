import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { useStoreSettings } from '@/features/settings/useStoreSettings'

/** Logo + store name. Uses the uploaded logo when the admin has set one, else the flame badge. */
export function BrandMark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { t } = useTranslation()
  const { data: settings } = useStoreSettings()
  const name = settings?.storeName ?? t('brand.name')

  return (
    <Link className={`flex items-center gap-2 ${tone === 'light' ? 'text-white' : ''}`} to="/">
      {settings?.logoUrl ? (
        <img alt="" className="size-10 rounded-2xl object-cover" src={settings.logoUrl} />
      ) : (
        <span className="grid size-10 place-items-center rounded-2xl bg-orange-600 text-white shadow-sm">
          <Icon className="size-6" name="flame" />
        </span>
      )}
      <span className="text-2xl font-black tracking-tight">{name}</span>
    </Link>
  )
}
