import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Icon } from './Icon'

/** Pulsing card placeholders shown while a grid of products or packages loads. */
export function CardGridSkeleton({ count = 4, className = 'sm:grid-cols-2 lg:grid-cols-4' }: { count?: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" aria-label={t('common.loading')} className={`grid gap-6 ${className}`} role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white" key={index}>
          <div className="aspect-[4/3] animate-pulse bg-orange-50" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-stone-100" />
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-stone-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Shown when a request fails; lets the visitor try again without reloading the page. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-3xl border border-red-100 bg-red-50/60 p-10 text-center" role="alert">
      <Icon className="mx-auto size-10 text-red-400" name="info" />
      <p className="mt-4 font-bold text-stone-700">{t('common.loadError')}</p>
      <Button className="mt-5" onClick={onRetry} variant="secondary">
        {t('common.retry')}
      </Button>
    </div>
  )
}
