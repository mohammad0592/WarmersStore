import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { EmptyState, MediaImage, SectionTitle } from '@/components/ui/Sections'
import { CardGridSkeleton, ErrorState } from '@/components/ui/States'
import { productsQuery } from '@/features/catalog/queries'
import { useCart, type CartLine } from '@/features/cart/cartStore'
import { useCartUi } from '@/features/cart/uiStore'
import type { CustomPackageRules, Product } from '@/lib/api/types'
import { formatHours, formatMoney, formatPieces } from '@/lib/format'
import { evaluateCustomPackage, maxQuantityFor, type BuilderIssue } from './customPricing'
import { customRulesQuery } from './queries'

const STEPPER_CAP = 999

/**
 * "صمّم باقتك على كيفك". With ?edit=<lineId> it loads that custom package from the cart and
 * saves changes back to it instead of adding a new one.
 */
export function CustomPackageBuilder() {
  const { t } = useTranslation()
  const products = useQuery(productsQuery)
  const rules = useQuery(customRulesQuery)

  let body
  if (products.isPending || rules.isPending) {
    body = <CardGridSkeleton className="sm:grid-cols-2" count={2} />
  } else if (products.isError || rules.isError) {
    body = (
      <ErrorState
        onRetry={() => {
          void products.refetch()
          void rules.refetch()
        }}
      />
    )
  } else if (!rules.data.isEnabled) {
    body = <EmptyState icon="spark" text={t('builder.unavailable')} />
  } else {
    const eligible = products.data.filter((p) => p.availableForCustom)
    body =
      eligible.length === 0 ? (
        <EmptyState icon="spark" text={t('builder.noProducts')} />
      ) : (
        <Builder products={eligible} rules={rules.data} />
      )
  }

  return (
    <section className="scroll-mt-24 bg-orange-50/70 py-20" id="custom">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionTitle eyebrow={t('package.customEyebrow')} text={t('package.customText')} title={t('package.customTitle')} />
        {body}
      </div>
    </section>
  )
}

function Builder({ products, rules }: { products: Product[]; rules: CustomPackageRules }) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editId = searchParams.get('edit')
  const editing = useCart((state) =>
    state.lines.find((l): l is Extract<CartLine, { kind: 'Custom' }> => l.lineId === editId && l.kind === 'Custom'),
  )

  // Re-initialise when the line being edited changes (keyed by the edit id).
  const [selection, setSelection] = useState<Record<number, number>>(() => toSelection(editing))
  const [loadedFor, setLoadedFor] = useState(editing?.lineId ?? null)
  if ((editing?.lineId ?? null) !== loadedFor) {
    setLoadedFor(editing?.lineId ?? null)
    setSelection(toSelection(editing))
  }

  const addCustom = useCart((state) => state.addCustom)
  const updateCustom = useCart((state) => state.updateCustom)
  const showToast = useCartUi((state) => state.showToast)
  const openCart = useCartUi((state) => state.openCart)

  const evaluation = evaluateCustomPackage(selection, products, rules)
  const items = evaluation.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity }))

  const submit = () => {
    if (!evaluation.isValid) return
    if (editing) {
      updateCustom(editing.lineId, items)
      showToast(t('cart.customUpdated'))
      navigate('/packages#custom', { replace: true })
      openCart()
    } else {
      addCustom(items)
      showToast(t('cart.customAdded'))
    }
    setSelection({})
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => {
          const quantity = selection[product.id] ?? 0
          const max = Math.min(maxQuantityFor(product.id, rules) ?? STEPPER_CAP, STEPPER_CAP)
          const hours = formatHours(product.heatMinHours, product.heatMaxHours)
          return (
            <article
              className={`flex gap-4 rounded-3xl border bg-white p-4 transition ${quantity ? 'border-orange-300 shadow-md' : 'border-stone-200'}`}
              key={product.id}
            >
              <MediaImage alt={product.images[0]?.alt ?? product.name} className="size-24 shrink-0 rounded-2xl" src={product.images[0]?.url} />
              <div className="min-w-0 flex-1">
                <h3 className="font-black">{product.name}</h3>
                <p className="mt-1 text-xs text-stone-500">
                  {hours && <>{hours} • </>}
                  {product.sellingUnit === 'Piece'
                    ? t('builder.unitPiece', { price: formatMoney(product.unitPrice!) })
                    : t('builder.unitBag', { price: formatMoney(product.unitPrice!), pieces: formatPieces(product.piecesPerSellingUnit) })}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <QuantityStepper
                    label={product.name}
                    max={max}
                    onChange={(value) => setSelection((current) => ({ ...current, [product.id]: value }))}
                    value={quantity}
                  />
                  <strong className="text-sm text-orange-700">{formatMoney(quantity * product.unitPrice!)}</strong>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <aside className="rounded-3xl bg-stone-950 p-6 text-white shadow-2xl lg:sticky lg:top-24">
        {editing && (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-orange-200">
            <Icon className="size-4" name="info" /> {t('builder.editing')}
          </p>
        )}
        <span className="text-xs font-extrabold text-orange-300">{t('builder.summary')}</span>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-xs text-stone-400">{t('builder.units')}</dt>
            <dd className="mt-1 text-xl font-black">{evaluation.units}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-xs text-stone-400">{t('builder.pieces')}</dt>
            <dd className="mt-1 text-xl font-black">{evaluation.pieces}</dd>
          </div>
        </dl>

        <div className="mt-5 space-y-3 border-y border-white/10 py-5 text-sm">
          {evaluation.lines.length === 0 ? (
            <p className="text-stone-500">{t('builder.placeholder')}</p>
          ) : (
            evaluation.lines.map((line) => (
              <div className="flex justify-between gap-3" key={line.product.id}>
                <span className="text-stone-300">
                  {line.quantity} × {line.product.name}
                </span>
                <span>{formatMoney(line.subtotal)}</span>
              </div>
            ))
          )}
        </div>

        {evaluation.discount > 0 && (
          <div className="mt-4 flex justify-between text-sm font-bold text-emerald-400">
            <span>{t('cart.discount')}</span>
            <span>-{formatMoney(evaluation.discount)}</span>
          </div>
        )}
        <div className="mt-4 flex items-end justify-between">
          <span className="text-sm text-stone-400">{t('builder.total')}</span>
          <strong className="text-3xl font-black text-orange-300">{formatMoney(evaluation.total)}</strong>
        </div>

        <p
          aria-live="polite"
          className={`mt-4 rounded-xl px-3 py-2 text-xs font-bold ${evaluation.isValid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-orange-100'}`}
        >
          {evaluation.isValid ? t('builder.ready') : issueMessage(evaluation.issues[0], t)}
        </p>

        <Button className="mt-5 w-full" disabled={!evaluation.isValid} onClick={submit}>
          <Icon className="size-5" name="cart" /> {editing ? t('builder.save') : t('builder.add')}
        </Button>
        {editing && (
          <Link
            className="mt-3 block text-center text-sm font-bold text-stone-300 hover:text-white"
            onClick={() => setSelection({})}
            replace
            to="/packages#custom"
          >
            {t('builder.cancelEdit')}
          </Link>
        )}
      </aside>
    </div>
  )
}

function toSelection(line: Extract<CartLine, { kind: 'Custom' }> | undefined): Record<number, number> {
  return Object.fromEntries((line?.items ?? []).map((item) => [item.productId, item.quantity]))
}

function issueMessage(issue: BuilderIssue, t: ReturnType<typeof useTranslation>['t']): string {
  switch (issue.code) {
    case 'empty':
      return issue.min ? t('builder.startMin', { min: issue.min }) : t('builder.start')
    case 'needMore':
      return t('builder.needMore', { count: issue.count })
    case 'tooMany':
      return t('builder.tooMany', { max: issue.max })
    case 'needAmount':
      return t('builder.needAmount', { amount: formatMoney(issue.amount) })
    case 'productMin':
      return t('builder.productMin', { name: issue.name, min: issue.min })
    case 'productMax':
      return t('builder.productMax', { name: issue.name, max: issue.max })
  }
}
