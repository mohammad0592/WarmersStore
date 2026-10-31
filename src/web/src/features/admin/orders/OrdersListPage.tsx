import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { formatMoney } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { PageHeader } from '../components/AdminUi'
import { adminOrdersQuery, formatDateTime, orderStatuses, statusTone, type OrderFilters, type OrderStatus } from './ordersApi'

/** Filters live in the URL so a filtered list survives opening an order and coming back. */
function readFilters(params: URLSearchParams): OrderFilters {
  const status = params.get('status') as OrderStatus | null
  return {
    status: status && orderStatuses.includes(status) ? status : '',
    q: params.get('q') ?? '',
    page: Math.max(1, Number(params.get('page')) || 1),
  }
}

const selectClass =
  'min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[status]}`}>{t(`admin.orders.status.${status}`)}</span>
}

export function OrdersListPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const [search, setSearch] = useState(filters.q)
  const orders = useQuery(adminOrdersQuery(filters))
  useDocumentTitle(t('admin.orders.title'))

  const update = (next: Partial<OrderFilters>) => {
    const merged = { ...filters, page: 1, ...next }
    const out = new URLSearchParams()
    if (merged.status) out.set('status', merged.status)
    if (merged.q.trim()) out.set('q', merged.q.trim())
    if (merged.page > 1) out.set('page', String(merged.page))
    setParams(out, { replace: true })
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    update({ q: search })
  }

  const pages = orders.data ? Math.max(1, Math.ceil(orders.data.total / orders.data.pageSize)) : 1

  return (
    <>
      <PageHeader title={t('admin.orders.title')} />
      <p className="-mt-3 mb-5 text-sm text-stone-500">{t('admin.orders.intro')}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={submitSearch} role="search">
          <input
            aria-label={t('admin.orders.search')}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.orders.searchPlaceholder')}
            type="search"
            value={search}
          />
          <Button type="submit" variant="secondary">
            {t('admin.orders.searchButton')}
          </Button>
        </form>
        <select
          aria-label={t('admin.orders.statusFilter')}
          className={selectClass}
          onChange={(e) => update({ status: e.target.value as OrderStatus | '' })}
          value={filters.status}
        >
          <option value="">{t('admin.orders.allStatuses')}</option>
          {orderStatuses.map((s) => (
            <option key={s} value={s}>
              {t(`admin.orders.status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {orders.isPending ? (
        <div aria-busy="true" className="h-60 animate-pulse rounded-2xl bg-white" role="status" />
      ) : orders.isError ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-stone-500">{filters.q || filters.status ? t('admin.orders.noMatches') : t('admin.orders.empty')}</p>
      ) : (
        <>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
            {orders.data.items.map((order) => (
              <li key={order.id}>
                <Link className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-orange-50/50" to={`/admin/orders/${order.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">
                      <bdi dir="ltr">{order.reference}</bdi> · {order.customerName}
                    </p>
                    <p className="text-xs text-stone-500">
                      <bdi dir="ltr">{order.customerWhatsApp}</bdi> · {formatDateTime(order.createdAt)} · {t('admin.orders.itemCount', { count: order.itemCount })}
                    </p>
                  </div>
                  <span className="font-black">{formatMoney(order.total)}</span>
                  <OrderStatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label={t('admin.orders.pagination')} className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Button disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })} variant="ghost">
                {t('admin.orders.previous')}
              </Button>
              <span className="font-bold text-stone-600">{t('admin.orders.pageOf', { page: filters.page, pages })}</span>
              <Button disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })} variant="ghost">
                {t('admin.orders.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  )
}
