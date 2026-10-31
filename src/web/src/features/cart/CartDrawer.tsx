import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { ApiError } from '@/lib/api/client'
import type { CheckoutError, Quote, QuoteLine } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { useDialog } from '@/lib/useDialog'
import { MAX_LINE_QUANTITY, useCart, type CartLine } from './cartStore'
import { useCartUi } from './uiStore'
import { useCartQuote } from './useCartQuote'

/**
 * The cart drawer from the design (slides in from the left in RTL). Every amount shown comes
 * from the server quote; the browser only keeps ids and quantities.
 */
export function CartDrawer() {
  const { t } = useTranslation()
  const open = useCartUi((state) => state.cartOpen)
  const closeCart = useCartUi((state) => state.closeCart)
  const lines = useCart((state) => state.lines)
  const clear = useCart((state) => state.clear)
  const quote = useCartQuote()
  const panel = useRef<HTMLElement>(null)
  const close = useCallback(() => closeCart(), [closeCart])
  useDialog(open, close, panel)

  if (!open) return null

  const quoteLines = new Map(quote.data?.lines.map((line) => [line.lineId, line]))
  const malformed = quote.error instanceof ApiError && quote.error.status === 400

  return (
    <div className="fixed inset-0 z-[80]">
      <button aria-label={t('cart.close')} className="absolute inset-0 size-full bg-stone-950/45 backdrop-blur-sm" onClick={close} tabIndex={-1} type="button" />
      <aside
        aria-labelledby="cart-title"
        aria-modal="true"
        className="absolute inset-y-0 left-0 flex w-full max-w-lg flex-col bg-canvas shadow-2xl"
        ref={panel}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-5">
          <div>
            <h2 className="text-xl font-black" id="cart-title">
              {t('cart.title')}
            </h2>
            {lines.length > 0 && <p className="mt-1 text-xs text-stone-500">{t('cart.lines', { count: lines.length })}</p>}
          </div>
          <button aria-label={t('cart.close')} className="grid size-10 place-items-center rounded-xl bg-stone-100" onClick={close} type="button">
            <Icon className="size-5" name="close" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <Icon className="mx-auto size-14 text-stone-300" name="bag" />
              <p className="mt-4 text-lg font-black">{t('cart.empty')}</p>
              <p className="mt-2 text-sm text-stone-500">{t('cart.emptyText')}</p>
              <ButtonLink className="mt-6" onClick={close} to="/packages">
                {t('cart.browsePackages')}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto p-5" aria-busy={quote.isFetching}>
              {lines.map((line) => (
                <li key={line.lineId}>
                  <CartLineCard line={line} onNavigate={close} quoteLine={quoteLines.get(line.lineId)} />
                </li>
              ))}
            </ul>

            <footer className="border-t border-stone-200 bg-white p-5">
              {malformed ? (
                <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
                  {t('cart.invalidCart')}{' '}
                  <button className="underline" onClick={clear} type="button">
                    {t('cart.clear')}
                  </button>
                </div>
              ) : quote.isError ? (
                <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
                  {t('cart.quoteError')}{' '}
                  <button className="underline" onClick={() => void quote.refetch()} type="button">
                    {t('common.retry')}
                  </button>
                </div>
              ) : null}
              {quote.data && <Totals quote={quote.data} />}
              {!quote.data && quote.isPending && <p className="text-sm text-stone-500">{t('cart.updating')}</p>}
              <p className="mt-3 text-xs text-stone-500">{t('cart.pricesFromServer')}</p>
              {/* "متابعة للطلب" (checkout) joins here in M7. */}
              <Button className="mt-4 w-full" onClick={close} variant="secondary">
                {t('cart.continueShopping')}
              </Button>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

function CartLineCard({ line, quoteLine, onNavigate }: { line: CartLine; quoteLine: QuoteLine | undefined; onNavigate: () => void }) {
  const { t } = useTranslation()
  const setQuantity = useCart((state) => state.setQuantity)
  const remove = useCart((state) => state.remove)
  const duplicate = useCart((state) => state.duplicate)
  const name = quoteLine?.name ?? (line.kind === 'ReadyMade' ? line.name : t('package.customTitle'))

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black">{name}</h3>
          {quoteLine && line.kind === 'ReadyMade' && (
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {quoteLine.items.map((i) => `${i.quantity} × ${i.productName}`).join('، ')}
            </p>
          )}
        </div>
        <button
          aria-label={t('cart.removeLabel', { name })}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => remove(line.lineId)}
          type="button"
        >
          <Icon className="size-4" name="trash" />
        </button>
      </div>

      {line.kind === 'Custom' && quoteLine && (
        <ul className="mt-3 space-y-1.5 text-sm text-stone-600">
          {quoteLine.items.map((item) => (
            <li className="flex justify-between gap-3" key={item.productId}>
              <span>
                {item.quantity} × {item.productName ?? '—'}
              </span>
              {item.subtotal !== null && <span>{formatMoney(item.subtotal)}</span>}
            </li>
          ))}
          {quoteLine.discount > 0 && (
            <li className="flex justify-between gap-3 font-bold text-emerald-700">
              <span>{t('cart.discount')}</span>
              <span>-{formatMoney(quoteLine.discount)}</span>
            </li>
          )}
        </ul>
      )}

      <LineErrors errors={quoteLine?.errors ?? []} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {line.kind === 'ReadyMade' ? (
          <QuantityStepper label={name} max={MAX_LINE_QUANTITY} min={1} onChange={(value) => setQuantity(line.lineId, value)} value={line.quantity} />
        ) : (
          <div className="flex gap-2 text-sm font-bold">
            <Link className="rounded-lg px-3 py-2 text-orange-700 hover:bg-orange-50" onClick={onNavigate} to={`/packages?edit=${line.lineId}#custom`}>
              {t('cart.edit')}
            </Link>
            <button
              aria-label={t('cart.duplicateLabel', { name })}
              className="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100"
              onClick={() => duplicate(line.lineId)}
              type="button"
            >
              {t('cart.duplicate')}
            </button>
          </div>
        )}
        <div className="text-left">
          {quoteLine ? (
            <>
              {line.kind === 'ReadyMade' && quoteLine.unitPrice !== null && line.quantity > 1 && (
                <span className="block text-xs text-stone-500">{t('cart.unitPrice', { price: formatMoney(quoteLine.unitPrice) })}</span>
              )}
              <strong className="text-lg font-black text-orange-700">{formatMoney(quoteLine.lineTotal)}</strong>
            </>
          ) : (
            <span className="inline-block h-6 w-16 animate-pulse rounded-full bg-stone-100" />
          )}
        </div>
      </div>
    </article>
  )
}

function LineErrors({ errors }: { errors: CheckoutError[] }) {
  if (errors.length === 0) return null
  return (
    <ul className="mt-3 space-y-1 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700" role="alert">
      {errors.map((error, index) => (
        <li key={`${error.code}-${index}`}>{error.message}</li>
      ))}
    </ul>
  )
}

function Totals({ quote }: { quote: Quote }) {
  const { t } = useTranslation()
  const { delivery } = quote
  const deliveryText =
    delivery.mode === 'None'
      ? t('cart.deliveryLater')
      : delivery.fee === null
        ? t('cart.deliveryByArea')
        : delivery.isFree
          ? t('cart.deliveryFree')
          : formatMoney(delivery.fee)

  return (
    <>
      <LineErrors errors={quote.errors} />
      <dl className="mt-1 space-y-2 text-sm">
        {quote.discountTotal > 0 && (
          <div className="flex justify-between font-bold text-emerald-700">
            <dt>{t('cart.discount')}</dt>
            <dd>-{formatMoney(quote.discountTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-stone-600">{t('cart.subtotal')}</dt>
          <dd className="font-bold">{formatMoney(quote.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone-600">{t('cart.delivery')}</dt>
          <dd className="font-bold">{deliveryText}</dd>
        </div>
        <div className="flex items-end justify-between border-t border-stone-100 pt-3">
          <dt className="font-black">{t('cart.estimatedTotal')}</dt>
          <dd className="text-2xl font-black text-orange-700">{formatMoney(quote.total)}</dd>
        </div>
      </dl>
    </>
  )
}
