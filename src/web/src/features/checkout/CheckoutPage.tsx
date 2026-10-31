import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/Sections'
import { toCartRequest, useCart } from '@/features/cart/cartStore'
import { useCartQuote } from '@/features/cart/useCartQuote'
import { useStoreSettings } from '@/features/settings/useStoreSettings'
import { ApiError, apiPost } from '@/lib/api/client'
import type { CheckoutError, Quote, SubmitResult } from '@/lib/api/types'
import { browser, lastOrder } from '@/lib/browser'
import { formatMoney } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { COUNTRY_CODES, composePhone } from './phone'
import { deliveryOptionsQuery } from './queries'

const formSchema = z
    .object({
      fullName: z.string().trim().min(2, 'checkout.errors.fullName').max(100, 'checkout.errors.tooLong'),
      countryCode: z.enum(COUNTRY_CODES),
      phone: z.string(),
      address: z.string().trim().min(5, 'checkout.errors.address').max(300, 'checkout.errors.tooLong'),
      deliveryAreaId: z.string(),
      deliveryInstructions: z.string().trim().max(300, 'checkout.errors.tooLong'),
      notes: z.string().trim().max(500, 'checkout.errors.tooLong'),
    })
    .superRefine((values, ctx) => {
      if (!composePhone(values.countryCode, values.phone)) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'checkout.errors.whatsApp' })
      }
    })

type FormValues = z.infer<typeof formSchema>
type FieldName = keyof FormValues

/** Server field keys (ValidationProblemDetails) → form fields. */
const serverFields: Record<string, FieldName> = {
  'customer.fullName': 'fullName',
  'customer.whatsAppNumber': 'phone',
  'customer.address': 'address',
  'customer.deliveryInstructions': 'deliveryInstructions',
  'customer.notes': 'notes',
}

export function CheckoutPage() {
  const { t } = useTranslation()
  const lines = useCart((state) => state.lines)
  useDocumentTitle(t('checkout.title'))

  if (lines.length === 0) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="mb-6 text-center text-3xl font-black">{t('checkout.title')}</h1>
        <EmptyState icon="bag" text={t('cart.empty')}>
          <ButtonLink to="/packages">{t('cart.browsePackages')}</ButtonLink>
        </EmptyState>
      </section>
    )
  }

  return <CheckoutForm />
}

function CheckoutForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const lines = useCart((state) => state.lines)
  const clearCart = useCart((state) => state.clear)
  const { data: settings } = useStoreSettings()
  const delivery = useQuery(deliveryOptionsQuery)
  const requireArea = delivery.data?.mode === 'PerArea'
  // One key per checkout visit: a double tap or a retry after a timeout reuses the same order.
  const [submissionId] = useState(() => globalThis.crypto?.randomUUID?.() ?? null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [rejected, setRejected] = useState<Quote | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: '', countryCode: '+970', phone: '', address: '', deliveryAreaId: '', deliveryInstructions: '', notes: '' },
    mode: 'onTouched',
  })
  const { register, handleSubmit, formState, setError, control } = form
  const areaValue = useWatch({ control, name: 'deliveryAreaId' })
  const deliveryAreaId = areaValue ? Number(areaValue) : null
  const quote = useCartQuote(deliveryAreaId)

  const submit = useMutation({
    mutationFn: (body: unknown) => apiPost<SubmitResult>('/api/checkout/submit', body),
  })

  const orderingAvailable = !!settings?.whatsAppNumber
  const shownQuote = rejected ?? quote.data
  const blocked = !orderingAvailable || !quote.data || !quote.data.isValid

  const onValid = async (values: FormValues) => {
    setSubmitError(null)
    setRejected(null)
    // Depends on delivery options loaded at runtime, so it's checked here rather than in the schema.
    if (requireArea && !values.deliveryAreaId) {
      setError('deliveryAreaId', { message: 'checkout.errors.area' })
      return
    }
    try {
      const result = await submit.mutateAsync({
        lines: toCartRequest(lines),
        deliveryAreaId,
        submissionId,
        customer: {
          fullName: values.fullName,
          whatsAppNumber: composePhone(values.countryCode, values.phone),
          address: values.address,
          deliveryInstructions: values.deliveryInstructions || null,
          notes: values.notes || null,
        },
      })
      lastOrder.save({ reference: result.reference, whatsAppUrl: result.whatsAppUrl })
      clearCart()
      navigate('/checkout/sent', { replace: true })
      browser.open(result.whatsAppUrl)
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const fieldErrors = (error.body as { errors?: Record<string, string[]> } | undefined)?.errors ?? {}
        let mapped = false
        for (const [key, messages] of Object.entries(fieldErrors)) {
          const field = serverFields[key]
          if (field) {
            setError(field, { message: messages[0] })
            mapped = true
          }
        }
        if (!mapped) setSubmitError(t('checkout.fixCart'))
      } else if (error instanceof ApiError && error.status === 422) {
        setRejected(error.body as Quote)
      } else if (error instanceof ApiError && error.status === 429) {
        setSubmitError(t('checkout.rateLimited'))
      } else {
        setSubmitError(t('checkout.submitError'))
      }
    }
  }

  const message = (text: string | undefined) => (text?.startsWith('checkout.') ? t(text as 'checkout.errors.fullName') : text)
  const fieldBase =
    'min-h-12 rounded-xl border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 aria-invalid:border-red-400'
  const fieldClass = `${fieldBase} mt-2 w-full`

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black">{t('checkout.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('checkout.subtitle')}</p>
      </div>

      {!orderingAvailable && settings && (
        <p className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="alert">
          <Icon className="size-5 shrink-0" name="info" /> {t('checkout.orderingUnavailable')}
        </p>
      )}

      <form
        className="grid overflow-hidden rounded-[2rem] border border-stone-200 bg-canvas md:grid-cols-[1fr_340px]"
        noValidate
        onSubmit={handleSubmit(onValid)}
      >
        <div className="space-y-5 p-5 sm:p-7">
          <Field error={message(formState.errors.fullName?.message)} label={t('checkout.fullName')} required>
            {(props) => <input autoComplete="name" className={fieldClass} placeholder={t('checkout.fullNamePlaceholder')} {...props} {...register('fullName')} />}
          </Field>

          <Field error={message(formState.errors.phone?.message)} hint={t('checkout.whatsAppHint')} label={t('checkout.whatsApp')} required>
            {(props) => (
              <div className="mt-2 flex gap-2" dir="ltr">
                <select aria-label={t('checkout.countryCode')} className={`${fieldBase} w-28 shrink-0 px-3`} {...register('countryCode')}>
                  <option value="+970">+970</option>
                  <option value="+972">+972</option>
                  <option value="other">{t('checkout.otherCountry')}</option>
                </select>
                <input
                  autoComplete="tel"
                  className={`${fieldBase} min-w-0 flex-1`}
                  inputMode="tel"
                  placeholder="0599 123 456"
                  type="tel"
                  {...props}
                  {...register('phone')}
                />
              </div>
            )}
          </Field>

          {requireArea && (
            <Field error={message(formState.errors.deliveryAreaId?.message)} label={t('checkout.deliveryArea')} required>
              {(props) => (
                <select className={fieldClass} {...props} {...register('deliveryAreaId')}>
                  <option value="">{t('checkout.chooseArea')}</option>
                  {delivery.data!.areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name} — {formatMoney(area.fee)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          <Field error={message(formState.errors.address?.message)} label={t('checkout.address')} required>
            {(props) => (
              <textarea
                autoComplete="street-address"
                className={`${fieldClass} min-h-24 py-3`}
                placeholder={t('checkout.addressPlaceholder')}
                {...props}
                {...register('address')}
              />
            )}
          </Field>

          <Field error={message(formState.errors.deliveryInstructions?.message)} label={t('checkout.instructions')}>
            {(props) => <input className={fieldClass} placeholder={t('checkout.instructionsPlaceholder')} {...props} {...register('deliveryInstructions')} />}
          </Field>

          <Field error={message(formState.errors.notes?.message)} label={t('checkout.notes')}>
            {(props) => <textarea className={`${fieldClass} min-h-20 py-3`} placeholder={t('checkout.notesPlaceholder')} {...props} {...register('notes')} />}
          </Field>
        </div>

        <aside className="border-t border-stone-200 bg-stone-50 p-5 sm:p-6 md:border-r md:border-t-0">
          <h2 className="font-black">{t('checkout.summary')}</h2>

          {!shownQuote ? (
            <p className="mt-4 text-sm text-stone-500">{t('cart.updating')}</p>
          ) : (
            <>
              <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
                {shownQuote.lines.map((line) => (
                  <li className="text-sm" key={line.lineId}>
                    <div className="flex justify-between gap-3">
                      <span className="text-stone-600">
                        {line.name ?? '—'}
                        {line.kind === 'ReadyMade' && ` × ${line.quantity}`}
                      </span>
                      <strong>{formatMoney(line.lineTotal)}</strong>
                    </div>
                    {line.kind === 'Custom' && (
                      <p className="mt-0.5 text-xs text-stone-500">{line.items.map((i) => `${i.quantity} × ${i.productName}`).join('، ')}</p>
                    )}
                    <ErrorList errors={line.errors} />
                  </li>
                ))}
              </ul>
              <dl className="mt-5 space-y-3 border-y border-stone-200 py-4 text-sm">
                {shownQuote.discountTotal > 0 && (
                  <Row label={t('cart.discount')}>-{formatMoney(shownQuote.discountTotal)}</Row>
                )}
                <Row label={t('cart.subtotal')}>{formatMoney(shownQuote.subtotal)}</Row>
                <Row label={t('cart.delivery')}>
                  {shownQuote.delivery.mode === 'None'
                    ? t('cart.deliveryLater')
                    : shownQuote.delivery.fee === null
                      ? t('cart.deliveryByArea')
                      : shownQuote.delivery.isFree
                        ? t('cart.deliveryFree')
                        : formatMoney(shownQuote.delivery.fee)}
                </Row>
              </dl>
              <div className="mt-4 flex items-end justify-between">
                <span className="font-bold">{t('checkout.total')}</span>
                <strong className="text-2xl text-orange-700">{formatMoney(shownQuote.total)}</strong>
              </div>
              <ErrorList errors={shownQuote.errors} />
            </>
          )}

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-orange-100 p-3 text-xs font-bold text-orange-900">
            <Icon className="size-5 shrink-0" name="shield" /> {t('checkout.cod')}
          </div>

          {submitError && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
              {submitError}
            </p>
          )}

          <Button className="mt-5 w-full" disabled={blocked || submit.isPending} type="submit" variant="whatsapp">
            <Icon className="size-5" name="whatsapp" /> {submit.isPending ? t('checkout.sending') : t('checkout.send')}
          </Button>
          <p className="mt-3 text-center text-[11px] leading-5 text-stone-500">{t('checkout.sendHint')}</p>
          {shownQuote && !shownQuote.isValid && (
            <ButtonLink className="mt-3 w-full" to="/packages" variant="ghost">
              {t('checkout.editCart')}
            </ButtonLink>
          )}
        </aside>
      </form>
    </section>
  )
}

type FieldProps = { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }

/** Label, input, hint and error wired together for screen readers. */
function Field({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: (props: FieldProps) => ReactNode
}) {
  const { t } = useTranslation()
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label className="text-sm font-bold" htmlFor={id}>
        {label}{' '}
        {required ? (
          <span aria-label={t('checkout.required')} className="text-red-500">
            *
          </span>
        ) : (
          <span className="font-normal text-stone-400">{t('checkout.optional')}</span>
        )}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && (
        <p className="mt-1 text-xs text-stone-500" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs font-bold text-red-600" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ErrorList({ errors }: { errors: CheckoutError[] }) {
  if (errors.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 rounded-xl bg-red-50 p-2 text-xs font-bold text-red-700" role="alert">
      {errors.map((error, index) => (
        <li key={`${error.code}-${index}`}>{error.message}</li>
      ))}
    </ul>
  )
}
