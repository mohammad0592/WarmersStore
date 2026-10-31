import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import { formatMoney } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, adminUpload, problemDetail, validationErrors } from '../adminApi'
import { Alert, Card, ConfirmDialog, inputClass, PageHeader, TextArea, TextInput, Toggle } from '../components/AdminUi'
import { adminPackageQuery, adminProductsQuery, toNumber, type AdminPackage, type AdminProduct } from './catalogApi'

interface FormValues {
  slug: string
  name: string
  description: string
  price: string
  isActive: boolean
  isFeatured: boolean
  items: { productId: string; quantity: string }[]
}

function toValues(p: AdminPackage | undefined): FormValues {
  return {
    slug: p?.slug ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    price: p ? String(p.price) : '',
    isActive: p?.isActive ?? false,
    isFeatured: p?.isFeatured ?? false,
    items: p?.items.map((i) => ({ productId: String(i.productId), quantity: String(i.quantity) })) ?? [{ productId: '', quantity: '1' }],
  }
}

export function PackageEditPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const packageId = id === undefined ? null : Number(id)
  const pkg = useQuery({ ...adminPackageQuery(packageId ?? 0), enabled: packageId !== null })
  const products = useQuery(adminProductsQuery)
  useDocumentTitle(packageId === null ? t('admin.packages.new') : (pkg.data?.name ?? t('admin.packages.edit')))

  if ((packageId !== null && pkg.isPending) || products.isPending) {
    return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" role="status" />
  }
  if ((packageId !== null && pkg.isError) || products.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void pkg.refetch()
          void products.refetch()
        }}
      />
    )
  }
  return <PackageForm key={pkg.data?.id ?? 'new'} pkg={pkg.data} products={products.data} />
}

function PackageForm({ pkg, products }: { pkg: AdminPackage | undefined; products: AdminProduct[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string; conflict?: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { register, handleSubmit, setError, formState, control, reset } = useForm<FormValues>({ defaultValues: toValues(pkg) })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const errors = formState.errors
  const watched = useWatch({ control })

  // Live hint: what the contents cost bought one by one, and the customer's saving.
  const byId = new Map(products.map((p) => [p.id, p]))
  const lines = (watched.items ?? []).map((i) => ({ product: byId.get(Number(i?.productId)), quantity: toNumber(i?.quantity) ?? 0 }))
  const priced = lines.every((l) => l.product?.unitPrice != null && l.quantity > 0) && lines.length > 0
  const regular = priced ? lines.reduce((sum, l) => sum + (l.product!.unitPrice ?? 0) * l.quantity, 0) : null
  const price = toNumber(watched.price ?? '')

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        slug: v.slug,
        name: v.name,
        description: v.description,
        price: toNumber(v.price),
        isActive: v.isActive,
        isFeatured: v.isFeatured,
        items: v.items.map((i) => ({ productId: toNumber(i.productId), quantity: toNumber(i.quantity) })),
        version: pkg?.version ?? null,
      }
      return pkg
        ? adminRequest<AdminPackage>('PUT', `/api/admin/packages/${pkg.id}`, body)
        : adminRequest<AdminPackage>('POST', '/api/admin/packages', body)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.package(saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: adminKeys.packages, exact: true })
      void queryClient.invalidateQueries({ queryKey: adminKeys.products, exact: true }) // "used in packages"
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
      if (!pkg) navigate(`/admin/packages/${saved.id}`, { replace: true })
      else {
        reset(toValues(saved))
        setStatus({ tone: 'success', message: t('admin.common.saved') })
      }
    },
    onError: (error) => {
      const fieldErrors = validationErrors(error)
      Object.entries(fieldErrors).forEach(([key, message]) => setError(key as 'name', { message }))
      setStatus(
        error instanceof ApiError && error.status === 409
          ? { tone: 'error', message: problemDetail(error) ?? t('admin.common.error'), conflict: true }
          : { tone: 'error', message: fieldErrors.items ?? (Object.keys(fieldErrors).length ? t('admin.common.fixErrors') : t('admin.common.error')) },
      )
    },
  })

  const removePackage = useMutation({
    mutationFn: () => adminRequest<void>('DELETE', `/api/admin/packages/${pkg!.id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminKeys.package(pkg!.id) })
      void queryClient.invalidateQueries({ queryKey: adminKeys.packages })
      navigate('/admin/packages', { replace: true })
    },
  })

  const itemError = (index: number, field: 'productId' | 'quantity') => errors.items?.[index]?.[field]?.message

  return (
    <>
      <PageHeader title={pkg ? pkg.name : t('admin.packages.new')}>
        <Link className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-white" to="/admin/packages">
          {t('admin.common.back')}
        </Link>
      </PageHeader>

      <form className="space-y-5" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Card title={t('admin.packages.basics')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput error={errors.name?.message} label={t('admin.packages.name')} required {...register('name')} />
            <TextInput dir="ltr" error={errors.slug?.message} hint={t('admin.common.slugHint')} label={t('admin.packages.slug')} required {...register('slug')} />
            <div className="sm:col-span-2">
              <TextArea error={errors.description?.message} label={t('admin.packages.description')} {...register('description')} />
            </div>
            <TextInput dir="ltr" error={errors.price?.message} inputMode="decimal" label={t('admin.packages.price')} required {...register('price')} />
          </div>
        </Card>

        <Card title={t('admin.packages.contents')}>
          <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.packages.contentsHint')}</p>
          <ul className="space-y-3">
            {fields.map((field, index) => {
              const product = byId.get(Number(watched.items?.[index]?.productId))
              return (
                <li className="grid grid-cols-[1fr_6rem_auto] items-start gap-2" key={field.id}>
                  <div>
                    <select
                      aria-describedby={itemError(index, 'productId') ? `item-${index}-product-error` : undefined}
                      aria-invalid={!!itemError(index, 'productId') || undefined}
                      aria-label={`${t('admin.packages.product')} ${index + 1}`}
                      className={`${inputClass} mt-0`}
                      {...register(`items.${index}.productId`)}
                    >
                      <option value="">{t('admin.packages.chooseProduct')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.unitPrice !== null ? ` (${formatMoney(p.unitPrice)})` : ''}
                        </option>
                      ))}
                    </select>
                    {product && !product.isActive && <p className="mt-1 text-xs font-bold text-amber-700">{t('admin.packages.inactiveProduct')}</p>}
                    {itemError(index, 'productId') && (
                      <p className="mt-1 text-xs font-bold text-red-600" id={`item-${index}-product-error`}>
                        {itemError(index, 'productId')}
                      </p>
                    )}
                  </div>
                  <div>
                    <input
                      aria-invalid={!!itemError(index, 'quantity') || undefined}
                      aria-label={`${t('admin.packages.quantity')} ${index + 1}`}
                      className={`${inputClass} mt-0`}
                      dir="ltr"
                      inputMode="numeric"
                      {...register(`items.${index}.quantity`)}
                    />
                    {itemError(index, 'quantity') && <p className="mt-1 text-xs font-bold text-red-600">{itemError(index, 'quantity')}</p>}
                  </div>
                  <button
                    aria-label={t('admin.packages.removeProduct', { name: product?.name ?? index + 1 })}
                    className="grid size-11 place-items-center rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    type="button"
                  >
                    <Icon className="size-4" name="trash" />
                  </button>
                </li>
              )
            })}
          </ul>
          <Button className="mt-3" onClick={() => append({ productId: '', quantity: '1' })} variant="ghost">
            <Icon className="size-4" name="plus" /> {t('admin.packages.addProduct')}
          </Button>
          {regular !== null && (
            <p className="mt-4 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
              {t('admin.packages.regularPrice', { price: formatMoney(regular) })}
              {' · '}
              {price !== null && !Number.isNaN(price) && regular > price
                ? t('admin.packages.savings', { amount: formatMoney(regular - price) })
                : t('admin.packages.noSavings')}
            </p>
          )}
        </Card>

        <Card title={t('admin.packages.visibility')}>
          <div className="grid gap-4">
            <Toggle label={t('admin.packages.isActive')} {...register('isActive')} />
            <Toggle label={t('admin.packages.isFeatured')} {...register('isFeatured')} />
          </div>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border-0">
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
          {status && (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <Alert tone={status.tone}>{status.message}</Alert>
              {status.conflict && (
                <Button
                  onClick={() =>
                    void queryClient.fetchQuery({ ...adminPackageQuery(pkg!.id), staleTime: 0 }).then((fresh) => {
                      setStatus(null)
                      reset(toValues(fresh))
                    })
                  }
                  variant="secondary"
                >
                  {t('admin.common.reload')}
                </Button>
              )}
            </div>
          )}
          {pkg && (
            <Button className="ms-auto text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)} variant="ghost">
              <Icon className="size-4" name="trash" /> {t('admin.common.delete')}
            </Button>
          )}
        </div>
      </form>

      <div className="mt-5">
        {pkg ? <PackageImage pkg={pkg} /> : <Card title={t('admin.packages.image')}><p className="text-sm text-stone-500">{t('admin.packages.imageAfterCreate')}</p></Card>}
      </div>

      {pkg && (
        <ConfirmDialog
          busy={removePackage.isPending}
          confirmLabel={t('admin.common.delete')}
          error={removePackage.isError ? (problemDetail(removePackage.error) ?? t('admin.common.error')) : null}
          message={t('admin.packages.deleteText', { name: pkg.name })}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => removePackage.mutate()}
          open={confirmDelete}
          title={t('admin.packages.deleteTitle')}
        />
      )}
    </>
  )
}

function PackageImage({ pkg }: { pkg: AdminPackage }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.package(pkg.id) })
    void queryClient.invalidateQueries({ queryKey: adminKeys.packages, exact: true })
  }

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return adminUpload<{ imageUrl: string }>('PUT', `/api/admin/packages/${pkg.id}/image`, form)
    },
    onSuccess: () => {
      if (fileInput.current) fileInput.current.value = ''
      refresh()
    },
  })
  const removeImage = useMutation({
    mutationFn: () => adminRequest<void>('DELETE', `/api/admin/packages/${pkg.id}/image`),
    onSuccess: refresh,
  })

  return (
    <Card title={t('admin.packages.image')}>
      <div className="flex flex-wrap items-center gap-4">
        {pkg.imageUrl ? (
          <img alt="" className="h-28 w-44 rounded-xl object-cover" src={pkg.imageUrl} />
        ) : (
          <span className="grid h-28 w-44 place-items-center rounded-xl bg-orange-50 text-sm text-orange-300">{t('admin.common.noImage')}</span>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('admin.common.uploadImage')}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate(file)
            }}
            ref={fileInput}
            type="file"
          />
          <Button disabled={upload.isPending} onClick={() => fileInput.current?.click()} variant="secondary">
            {upload.isPending ? t('admin.common.uploading') : t('admin.common.uploadImage')}
          </Button>
          {pkg.imageUrl && (
            <Button className="text-red-600" disabled={removeImage.isPending} onClick={() => removeImage.mutate()} variant="ghost">
              {t('admin.common.removeImage')}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-500">{t('admin.common.imageHint')}</p>
      {upload.isError && (
        <div className="mt-3">
          <Alert>{validationErrors(upload.error).file ?? t('admin.common.error')}</Alert>
        </div>
      )}
    </Card>
  )
}
