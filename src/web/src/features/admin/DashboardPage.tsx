import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { dashboardQuery, type Dashboard } from './adminApi'

export function DashboardPage() {
  const { t } = useTranslation()
  const dashboard = useQuery(dashboardQuery)
  useDocumentTitle(t('admin.title'))

  return (
    <>
      <h1 className="mb-6 text-2xl font-black">{t('admin.title')}</h1>
      {dashboard.isPending ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="h-28 animate-pulse rounded-2xl bg-white" key={i} />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState onRetry={() => void dashboard.refetch()} />
      ) : (
        <DashboardContent data={dashboard.data} />
      )}
    </>
  )
}

function DashboardContent({ data }: { data: Dashboard }) {
  const { t } = useTranslation()

  const checklist = [
    { done: data.whatsAppConfigured, label: t('admin.dashboard.setupWhatsApp'), todo: t('admin.dashboard.setupWhatsAppTodo') },
    { done: data.productsWithoutPrice === 0, label: t('admin.dashboard.setupPrices'), todo: t('admin.dashboard.setupPricesTodo', { count: data.productsWithoutPrice }) },
    { done: data.activeProducts > 0, label: t('admin.dashboard.setupProducts'), todo: t('admin.dashboard.setupProductsTodo') },
    { done: data.activePackages > 0, label: t('admin.dashboard.setupPackages'), todo: t('admin.dashboard.setupPackagesTodo') },
    { done: data.showDistributors, label: t('admin.dashboard.setupDistributors'), todo: t('admin.dashboard.setupDistributorsTodo') },
  ]

  return (
    <div className="space-y-8">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat icon="flame" label={t('admin.dashboard.activeProducts')} note={t('admin.dashboard.ofTotal', { total: data.totalProducts })}>
          {data.activeProducts}
        </Stat>
        <Stat icon="package" label={t('admin.dashboard.activePackages')}>
          {data.activePackages}
        </Stat>
        <Stat icon="spark" label={t('admin.dashboard.customPackages')}>
          {data.customPackagesEnabled ? t('admin.dashboard.enabled') : t('admin.dashboard.disabled')}
        </Stat>
        <Stat icon="map-pin" label={t('admin.dashboard.activeDistributors')}>
          {data.activeDistributors}
        </Stat>
        <Stat highlight={data.pendingOrders > 0} icon="whatsapp" label={t('admin.dashboard.pendingOrders')}>
          {data.pendingOrders}
        </Stat>
      </dl>

      <section aria-labelledby="setup-title" className="rounded-2xl bg-white p-6">
        <h2 className="text-lg font-black" id="setup-title">
          {t('admin.dashboard.setup')}
        </h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {checklist.map((item) => (
            <li className="flex items-start gap-3 py-3" key={item.label}>
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
              >
                <Icon className="size-4" name={item.done ? 'check' : 'info'} />
                <span className="sr-only">{item.done ? t('admin.dashboard.done') : t('admin.dashboard.todo')}</span>
              </span>
              <div>
                <p className="font-bold">{item.label}</p>
                {!item.done && <p className="mt-0.5 text-sm text-stone-500">{item.todo}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ icon, label, note, highlight = false, children }: { icon: IconName; label: string; note?: string; highlight?: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-2xl p-5 ${highlight ? 'bg-orange-600 text-white' : 'bg-white'}`}>
      <dt className={`flex items-center gap-2 text-sm font-bold ${highlight ? 'text-orange-100' : 'text-stone-500'}`}>
        <Icon className="size-4" name={icon} /> {label}
      </dt>
      <dd className="mt-2 text-3xl font-black">{children}</dd>
      {note && <dd className={`text-xs ${highlight ? 'text-orange-100' : 'text-stone-400'}`}>{note}</dd>}
    </div>
  )
}
