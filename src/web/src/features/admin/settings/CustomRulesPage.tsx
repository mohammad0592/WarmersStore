import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, validationErrors } from '../adminApi'
import { Alert, Card, PageHeader, SelectInput, TextInput, Toggle } from '../components/AdminUi'
import { adminProductsQuery, toNumber, type AdminProduct } from '../catalog/catalogApi'
import { adminCustomRulesQuery, settingsKeys, type AdminCustomRules, type DiscountType } from './settingsApi'

interface FormValues {
  isEnabled: boolean
  minItems: string
  maxItems: string
  minSubtotal: string
  maxQuantityPerProduct: string
  productRules: { productId: string; minQty: string; maxQty: string }[]
  discountTiers: { minItems: string; type: DiscountType; value: string; isActive: boolean }[]
}

const text = (n: number | null) => n?.toString() ?? ''

function toValues(r: AdminCustomRules): FormValues {
  return {
    isEnabled: r.isEnabled,
    minItems: text(r.minItems),
    maxItems: text(r.maxItems),
    minSubtotal: text(r.minSubtotal),
    maxQuantityPerProduct: text(r.maxQuantityPerProduct),
    productRules: r.productRules.map((p) => ({ productId: String(p.productId), minQty: text(p.minQty), maxQty: text(p.maxQty) })),
    discountTiers: r.discountTiers.map((d) => ({ minItems: String(d.minItems), type: d.type, value: String(d.value), isActive: d.isActive })),
  }
}

export function CustomRulesPage() {
  const { t } = useTranslation()
  const rules = useQuery(adminCustomRulesQuery)
  const products = useQuery(adminProductsQuery)
  useDocumentTitle(t('admin.customRules.title'))

  if (rules.isPending || products.isPending) return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" role="status" />
  if (rules.isError || products.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void rules.refetch()
          void products.refetch()
        }}
      />
    )
  }
  return (
    <>
      <PageHeader title={t('admin.customRules.title')} />
      <p className="-mt-3 mb-5 text-sm text-stone-500">{t('admin.customRules.intro')}</p>
      <CustomRulesForm products={products.data.filter((p) => p.isCustomEligible)} rules={rules.data} />
    </>
  )
}

function CustomRulesForm({ rules, products }: { rules: AdminCustomRules; products: AdminProduct[] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)
  const { register, handleSubmit, setError, formState, reset, control } = useForm<FormValues>({ defaultValues: toValues(rules) })
  const productRules = useFieldArray({ control, name: 'productRules' })
  const tiers = useFieldArray({ control, name: 'discountTiers' })
  const errors = formState.errors as FieldErrors<FormValues> & Record<string, { message?: string } | undefined>

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      adminRequest<AdminCustomRules>('PUT', '/api/admin/custom-package-rules', {
        isEnabled: v.isEnabled,
        minItems: toNumber(v.minItems),
        maxItems: toNumber(v.maxItems),
        minSubtotal: toNumber(v.minSubtotal),
        maxQuantityPerProduct: toNumber(v.maxQuantityPerProduct),
        productRules: v.productRules.map((r) => ({ productId: toNumber(r.productId), minQty: toNumber(r.minQty), maxQty: toNumber(r.maxQty) })),
        discountTiers: v.discountTiers.map((d) => ({ minItems: toNumber(d.minItems), type: d.type, value: toNumber(d.value), isActive: d.isActive })),
      }),
    onSuccess: (saved) => {
      reset(toValues(saved))
      setStatus({ tone: 'success', message: t('admin.common.saved') })
      queryClient.setQueryData(settingsKeys.customRules, saved)
      void queryClient.invalidateQueries({ queryKey: ['custom-package-rules'] })
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
    },
    onError: (error) => {
      const fields = validationErrors(error)
      Object.entries(fields).forEach(([key, message]) => setError(key as keyof FormValues, { message }))
      setStatus({ tone: 'error', message: Object.keys(fields).length ? t('admin.common.fixErrors') : t('admin.common.error') })
    },
  })

  const iconButton = 'grid size-11 place-items-center self-end rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600'

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
      <Card title={t('admin.customRules.general')}>
        <Toggle hint={t('admin.customRules.enabledHint')} label={t('admin.customRules.enabled')} {...register('isEnabled')} />
        <p className="mt-4 mb-3 text-xs text-stone-500">{t('admin.customRules.emptyMeansNone')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput dir="ltr" error={errors.minItems?.message} inputMode="numeric" label={t('admin.customRules.minItems')} {...register('minItems')} />
          <TextInput dir="ltr" error={errors.maxItems?.message} inputMode="numeric" label={t('admin.customRules.maxItems')} {...register('maxItems')} />
          <TextInput dir="ltr" error={errors.minSubtotal?.message} inputMode="decimal" label={t('admin.customRules.minSubtotal')} {...register('minSubtotal')} />
          <TextInput
            dir="ltr"
            error={errors.maxQuantityPerProduct?.message}
            inputMode="numeric"
            label={t('admin.customRules.maxPerProduct')}
            {...register('maxQuantityPerProduct')}
          />
        </div>
      </Card>

      <Card title={t('admin.customRules.productRules')}>
        <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.customRules.productRulesHint')}</p>
        <div className="space-y-3">
          {productRules.fields.map((field, i) => (
            <div className="grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]" key={field.id}>
              <SelectInput error={errors.productRules?.[i]?.productId?.message} label={t('admin.customRules.product')} {...register(`productRules.${i}.productId`)}>
                <option value="">{t('admin.customRules.chooseProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
              <TextInput dir="ltr" error={errors.productRules?.[i]?.minQty?.message} inputMode="numeric" label={t('admin.customRules.minQty')} {...register(`productRules.${i}.minQty`)} />
              <TextInput dir="ltr" error={errors.productRules?.[i]?.maxQty?.message} inputMode="numeric" label={t('admin.customRules.maxQty')} {...register(`productRules.${i}.maxQty`)} />
              <button aria-label={t('admin.customRules.removeRule')} className={iconButton} onClick={() => productRules.remove(i)} type="button">
                <Icon className="size-4" name="trash" />
              </button>
            </div>
          ))}
        </div>
        <Button className="mt-3" onClick={() => productRules.append({ productId: '', minQty: '', maxQty: '' })} variant="secondary">
          <Icon className="size-4" name="plus" /> {t('admin.customRules.addRule')}
        </Button>
      </Card>

      <Card title={t('admin.customRules.tiers')}>
        <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.customRules.tiersHint')}</p>
        <div className="space-y-3">
          {tiers.fields.map((field, i) => (
            <div className="grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end" key={field.id}>
              <TextInput dir="ltr" error={errors.discountTiers?.[i]?.minItems?.message} inputMode="numeric" label={t('admin.customRules.tierMinItems')} {...register(`discountTiers.${i}.minItems`)} />
              <SelectInput error={errors.discountTiers?.[i]?.type?.message} label={t('admin.customRules.tierType')} {...register(`discountTiers.${i}.type`)}>
                <option value="Percent">{t('admin.customRules.percent')}</option>
                <option value="Fixed">{t('admin.customRules.fixed')}</option>
              </SelectInput>
              <TextInput dir="ltr" error={errors.discountTiers?.[i]?.value?.message} inputMode="decimal" label={t('admin.customRules.tierValue')} {...register(`discountTiers.${i}.value`)} />
              <div className="pb-3">
                <Toggle label={t('admin.common.active')} {...register(`discountTiers.${i}.isActive`)} />
              </div>
              <button aria-label={t('admin.customRules.removeTier')} className={iconButton} onClick={() => tiers.remove(i)} type="button">
                <Icon className="size-4" name="trash" />
              </button>
            </div>
          ))}
        </div>
        <Button className="mt-3" onClick={() => tiers.append({ minItems: '', type: 'Percent', value: '', isActive: true })} variant="secondary">
          <Icon className="size-4" name="plus" /> {t('admin.customRules.addTier')}
        </Button>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border-0">
        <Button disabled={save.isPending} type="submit">
          {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
        </Button>
        {status && <Alert tone={status.tone}>{status.message}</Alert>}
      </div>
    </form>
  )
}
