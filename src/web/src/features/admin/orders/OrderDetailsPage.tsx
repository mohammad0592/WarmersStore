import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { formatMoney, formatPieces, whatsAppChatUrl } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, problemDetail } from '../adminApi'
import { Alert, Card, ConfirmDialog, PageHeader } from '../components/AdminUi'
import { adminOrderQuery, formatDateTime, orderKeys, type AdminOrder, type OrderStatus } from './ordersApi'
import { OrderStatusBadge } from './OrdersListPage'

export function OrderDetailsPage() {
  const { t } = useTranslation()
  const id = Number(useParams().id)
  const order = useQuery(adminOrderQuery(id))
  useDocumentTitle(order.data ? t('admin.orders.detailTitle', { reference: order.data.reference }) : t('admin.orders.title'))

  if (order.isPending) return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" role="status" />
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />
  return <OrderDetails order={order.data} />
}

function OrderDetails({ order }: { order: AdminOrder }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<OrderStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const chatUrl = whatsAppChatUrl(order.customerWhatsApp)

  const move = useMutation({
    mutationFn: (status: OrderStatus) => adminRequest<AdminOrder>('PATCH', `/api/admin/orders/${order.id}/status`, { status }),
    onSuccess: (saved) => {
      setPending(null)
      queryClient.setQueryData(orderKeys.detail(order.id), saved)
      void queryClient.invalidateQueries({ queryKey: orderKeys.all, predicate: (q) => q.queryKey[2] === 'list' })
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
    },
  })

  const copyMessage = async () => {
    await navigator.clipboard?.writeText(order.whatsAppMessage)
    setCopied(true)
  }

  return (
    <>
      <PageHeader title={t('admin.orders.detailTitle', { reference: order.reference })}>
        <Link className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-white" to="/admin/orders">
          {t('admin.common.back')}
        </Link>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <OrderStatusBadge status={order.status} />
              <span className="text-sm text-stone-500">
                {t('admin.orders.placedAt', { date: formatDateTime(order.createdAt) })}
                {order.status !== 'PendingConfirmation' &&` · ${t('admin.orders.changedAt', { date: formatDateTime(order.statusChangedAt) })}`}
              </span>
            </div>
            {order.status === 'PendingConfirmation' && (
              <div className="mt-4">
                <Alert tone="info">{t('admin.orders.pendingNote')}</Alert>
              </div>
            )}
            {order.allowedNextStatuses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {order.allowedNextStatuses.map((status) => (
                  <Button
                    className={status === 'Cancelled' ? 'text-red-600 hover:bg-red-50' : ''}
                    key={status}
                    onClick={() => {
                      move.reset()
                      setPending(status)
                    }}
                    variant={status === 'Cancelled' ? 'ghost' : 'primary'}
                  >
                    {t(`admin.orders.moveTo.${status}`)}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card title={t('admin.orders.items')}>
            <ul className="divide-y divide-stone-100">
              {order.items.map((item, i) => (
                <li className="py-3 first:pt-0 last:pb-0" key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-black">
                      {item.name} {item.quantity > 1 && <span className="text-stone-500">× {item.quantity}</span>}
                    </p>
                    <p className="font-black">{formatMoney(item.lineTotal)}</p>
                  </div>
                  <ul className="mt-1 text-sm text-stone-600">
                    {item.products.map((p, j) => (
                      <li key={j}>
                        {p.productName} × {p.quantity} ({formatPieces(p.pieces)})
                      </li>
                    ))}
                  </ul>
                  {item.discount > 0 && <p className="mt-1 text-xs font-bold text-emerald-700">{t('admin.orders.discount', { amount: formatMoney(item.discount) })}</p>}
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-stone-100 pt-4 text-sm">
              <Row label={t('admin.orders.subtotal')} value={formatMoney(order.subtotal)} />
              {order.discountTotal > 0 && <Row label={t('admin.orders.discountTotal')} value={`− ${formatMoney(order.discountTotal)}`} />}
              <Row
                label={order.deliveryAreaName ? t('admin.orders.deliveryTo', { area: order.deliveryAreaName }) : t('admin.orders.delivery')}
                value={order.deliveryMode === 'None' ? t('admin.orders.deliveryByAgreement') : formatMoney(order.deliveryFee)}
              />
              <div className="flex justify-between pt-1 text-base font-black">
                <dt>{t('admin.orders.total')}</dt>
                <dd>{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <Card title={t('admin.orders.message')}>
            <p className="-mt-2 mb-3 text-xs text-stone-500">{t('admin.orders.messageHint')}</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-4 font-sans text-sm leading-6">{order.whatsAppMessage}</pre>
            <Button className="mt-3" onClick={() => void copyMessage()} variant="secondary">
              {copied ? t('admin.orders.copied') : t('admin.orders.copy')}
            </Button>
          </Card>
        </div>

        <Card className="self-start" title={t('admin.orders.customer')}>
          <dl className="space-y-3 text-sm">
            <Detail label={t('admin.orders.name')}>{order.customerName}</Detail>
            <Detail label={t('admin.orders.whatsApp')}>
              <bdi dir="ltr">{order.customerWhatsApp}</bdi>
              {chatUrl && (
                <a className="ms-2 inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline" href={chatUrl} rel="noopener noreferrer" target="_blank">
                  <Icon className="size-4" name="whatsapp" /> {t('admin.orders.openChat')}
                </a>
              )}
            </Detail>
            <Detail label={t('admin.orders.address')}>{order.address}</Detail>
            {order.deliveryInstructions && <Detail label={t('admin.orders.instructions')}>{order.deliveryInstructions}</Detail>}
            {order.notes && <Detail label={t('admin.orders.notes')}>{order.notes}</Detail>}
          </dl>
        </Card>
      </div>

      <ConfirmDialog
        busy={move.isPending}
        confirmLabel={pending ? t(`admin.orders.moveTo.${pending}`) : ''}
        error={move.isError ? (problemDetail(move.error) ?? t('admin.common.error')) : null}
        message={pending ? t(`admin.orders.confirmText.${pending}`, { reference: order.reference }) : ''}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && move.mutate(pending)}
        open={pending !== null}
        title={t('admin.orders.confirmTitle')}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-stone-600">
      <dt>{label}</dt>
      <dd className="font-bold text-stone-900">{value}</dd>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold text-stone-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap">{children}</dd>
    </div>
  )
}
