import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, adminUpload, problemDetail, validationErrors } from '../adminApi'
import { Alert, Card, ConfirmDialog, PageHeader, ReorderButtons, SelectInput, TextArea, TextInput, Toggle } from '../components/AdminUi'
import { adminProductQuery, moved, toNumber, type AdminProduct, type AdminProductImage } from './catalogApi'

interface FormValues {
  slug: string
  name: string
  shortDescription: string
  description: string
  usageGuidance: string
  safetyInfo: string
  widthCm: string
  heightCm: string
  heatMinHours: string
  heatMaxHours: string
  isAdhesive: 'yes' | 'no' | 'unknown'
  piecesPerRetailBag: string
  sellingUnit: 'Piece' | 'RetailBag'
  unitPrice: string
  isActive: boolean
  isCustomEligible: boolean
}

const text = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value))

function toValues(p: AdminProduct | undefined): FormValues {
  return {
    slug: text(p?.slug),
    name: text(p?.name),
    shortDescription: text(p?.shortDescription),
    description: text(p?.description),
    usageGuidance: text(p?.usageGuidance),
    safetyInfo: text(p?.safetyInfo),
    widthCm: text(p?.widthCm),
    heightCm: text(p?.heightCm),
    heatMinHours: text(p?.heatMinHours),
    heatMaxHours: text(p?.heatMaxHours),
    isAdhesive: p?.isAdhesive === true ? 'yes' : p?.isAdhesive === false ? 'no' : 'unknown',
    piecesPerRetailBag: text(p?.piecesPerRetailBag ?? 1),
    sellingUnit: p?.sellingUnit ?? 'RetailBag',
    unitPrice: text(p?.unitPrice),
    isActive: p?.isActive ?? false,
    isCustomEligible: p?.isCustomEligible ?? true,
  }
}

function toRequest(v: FormValues, version: number | null) {
  return {
    slug: v.slug,
    name: v.name,
    shortDescription: v.shortDescription,
    description: v.description,
    usageGuidance: v.usageGuidance,
    safetyInfo: v.safetyInfo,
    widthCm: toNumber(v.widthCm),
    heightCm: toNumber(v.heightCm),
    heatMinHours: toNumber(v.heatMinHours),
    heatMaxHours: toNumber(v.heatMaxHours),
    isAdhesive: v.isAdhesive === 'unknown' ? null : v.isAdhesive === 'yes',
    piecesPerRetailBag: toNumber(v.piecesPerRetailBag),
    sellingUnit: v.sellingUnit,
    unitPrice: toNumber(v.unitPrice),
    isActive: v.isActive,
    isCustomEligible: v.isCustomEligible,
    version,
  }
}

export function ProductEditPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const productId = id === undefined ? null : Number(id)
  const product = useQuery({ ...adminProductQuery(productId ?? 0), enabled: productId !== null })
  useDocumentTitle(productId === null ? t('admin.products.new') : (product.data?.name ?? t('admin.products.edit')))

  if (productId !== null && product.isPending) {
    return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" role="status" />
  }
  if (productId !== null && product.isError) {
    return <ErrorState onRetry={() => void product.refetch()} />
  }
  return <ProductForm key={product.data?.id ?? 'new'} product={product.data} />
}

function ProductForm({ product }: { product: AdminProduct | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string; conflict?: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { register, handleSubmit, setError, formState, reset } = useForm<FormValues>({ defaultValues: toValues(product) })
  const errors = formState.errors

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      product
        ? adminRequest<AdminProduct>('PUT', `/api/admin/products/${product.id}`, toRequest(values, product.version))
        : adminRequest<AdminProduct>('POST', '/api/admin/products', toRequest(values, null)),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.product(saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: adminKeys.products, exact: true })
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
      if (!product) navigate(`/admin/products/${saved.id}`, { replace: true })
      else {
        reset(toValues(saved))
        setStatus({ tone: 'success', message: t('admin.common.saved') })
      }
    },
    onError: (error) => {
      const fields = validationErrors(error)
      Object.entries(fields).forEach(([key, message]) => setError(key as keyof FormValues, { message }))
      setStatus(
        error instanceof ApiError && error.status === 409
          ? { tone: 'error', message: problemDetail(error) ?? t('admin.common.error'), conflict: true }
          : { tone: 'error', message: Object.keys(fields).length ? t('admin.common.fixErrors') : t('admin.common.error') },
      )
    },
  })

  const remove = useMutation({
    mutationFn: () => adminRequest<void>('DELETE', `/api/admin/products/${product!.id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminKeys.product(product!.id) })
      void queryClient.invalidateQueries({ queryKey: adminKeys.products })
      navigate('/admin/products', { replace: true })
    },
  })

  const reload = async () => {
    setStatus(null)
    const fresh = await queryClient.fetchQuery({ ...adminProductQuery(product!.id), staleTime: 0 })
    reset(toValues(fresh))
  }

  return (
    <>
      <PageHeader title={product ? product.name : t('admin.products.new')}>
        <Link className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-white" to="/admin/products">
          {t('admin.common.back')}
        </Link>
      </PageHeader>

      <form className="space-y-5" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Card title={t('admin.products.basics')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput error={errors.name?.message} label={t('admin.products.name')} required {...register('name')} />
            <TextInput dir="ltr" error={errors.slug?.message} hint={t('admin.common.slugHint')} label={t('admin.products.slug')} required {...register('slug')} />
          </div>
        </Card>

        <Card title={t('admin.products.texts')}>
          <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.products.textsHint')}</p>
          <div className="grid gap-4">
            <TextInput error={errors.shortDescription?.message} hint={t('admin.products.shortDescriptionHint')} label={t('admin.products.shortDescription')} {...register('shortDescription')} />
            <TextArea error={errors.description?.message} label={t('admin.products.description')} {...register('description')} />
            <TextArea error={errors.usageGuidance?.message} label={t('admin.products.usageGuidance')} {...register('usageGuidance')} />
            <TextArea error={errors.safetyInfo?.message} label={t('admin.products.safetyInfo')} {...register('safetyInfo')} />
          </div>
        </Card>

        <Card title={t('admin.products.specs')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextInput dir="ltr" error={errors.widthCm?.message} inputMode="decimal" label={t('admin.products.widthCm')} required {...register('widthCm')} />
            <TextInput dir="ltr" error={errors.heightCm?.message} inputMode="decimal" label={t('admin.products.heightCm')} required {...register('heightCm')} />
            <TextInput dir="ltr" error={errors.piecesPerRetailBag?.message} inputMode="numeric" label={t('admin.products.piecesPerRetailBag')} required {...register('piecesPerRetailBag')} />
            <TextInput dir="ltr" error={errors.heatMinHours?.message} inputMode="decimal" label={t('admin.products.heatMinHours')} {...register('heatMinHours')} />
            <TextInput dir="ltr" error={errors.heatMaxHours?.message} inputMode="decimal" label={t('admin.products.heatMaxHours')} {...register('heatMaxHours')} />
            <SelectInput label={t('admin.products.adhesive')} {...register('isAdhesive')}>
              <option value="unknown">{t('admin.products.adhesiveUnknown')}</option>
              <option value="yes">{t('admin.products.adhesiveYes')}</option>
              <option value="no">{t('admin.products.adhesiveNo')}</option>
            </SelectInput>
          </div>
        </Card>

        <Card title={t('admin.products.selling')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput error={errors.sellingUnit?.message} hint={t('admin.products.sellingUnitHint')} label={t('admin.products.sellingUnit')} required {...register('sellingUnit')}>
              <option value="RetailBag">{t('admin.products.sellBag')}</option>
              <option value="Piece">{t('admin.products.sellPiece')}</option>
            </SelectInput>
            <TextInput dir="ltr" error={errors.unitPrice?.message} inputMode="decimal" label={t('admin.products.unitPrice')} {...register('unitPrice')} />
          </div>
        </Card>

        <Card title={t('admin.products.visibility')}>
          <div className="grid gap-4">
            <Toggle hint={t('admin.products.isActiveHint')} label={t('admin.products.isActive')} {...register('isActive')} />
            <Toggle label={t('admin.products.isCustomEligible')} {...register('isCustomEligible')} />
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
                <Button onClick={() => void reload()} variant="secondary">
                  {t('admin.common.reload')}
                </Button>
              )}
            </div>
          )}
          {product && (
            <Button className="ms-auto text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)} variant="ghost">
              <Icon className="size-4" name="trash" /> {t('admin.common.delete')}
            </Button>
          )}
        </div>
      </form>

      <div className="mt-5">
        {product ? <ProductImages product={product} /> : <Card title={t('admin.products.images')}><p className="text-sm text-stone-500">{t('admin.products.imagesAfterCreate')}</p></Card>}
      </div>

      {product && (
        <ConfirmDialog
          busy={remove.isPending}
          confirmLabel={t('admin.common.delete')}
          error={remove.isError ? (problemDetail(remove.error) ?? t('admin.common.error')) : null}
          message={
            product.usedInPackages.length > 0
              ? t('admin.products.deleteBlocked', { names: product.usedInPackages.join('، ') })
              : t('admin.products.deleteText', { name: product.name })
          }
          onCancel={() => {
            setConfirmDelete(false)
            remove.reset()
          }}
          onConfirm={() => remove.mutate()}
          open={confirmDelete}
          title={t('admin.products.deleteTitle')}
        />
      )}
    </>
  )
}

function ProductImages({ product }: { product: AdminProduct }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [altText, setAltText] = useState('')
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.product(product.id) })
    void queryClient.invalidateQueries({ queryKey: adminKeys.products, exact: true })
  }

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      if (altText.trim()) form.append('altText', altText.trim())
      return adminUpload<AdminProductImage>('POST', `/api/admin/products/${product.id}/images`, form)
    },
    onSuccess: () => {
      setAltText('')
      if (fileInput.current) fileInput.current.value = ''
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (imageId: number) => adminRequest<void>('DELETE', `/api/admin/products/${product.id}/images/${imageId}`),
    onSuccess: refresh,
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => adminRequest<void>('PUT', `/api/admin/products/${product.id}/images/order`, { ids }),
    onSettled: refresh,
  })

  const uploadError = upload.error ? (validationErrors(upload.error).file ?? t('admin.common.error')) : null

  return (
    <Card title={t('admin.products.images')}>
      <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.products.imagesHint')}</p>
      {product.images.length > 0 && (
        <ul className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.images.map((image, index) => (
            <li className="flex items-center gap-3 rounded-xl border border-stone-200 p-2" key={image.id}>
              <img alt={image.altText ?? ''} className="size-16 rounded-lg object-cover" src={image.url} />
              <span className="min-w-0 flex-1 truncate text-xs text-stone-500">{image.altText ?? '—'}</span>
              <ReorderButtons
                disabled={reorder.isPending}
                isFirst={index === 0}
                isLast={index === product.images.length - 1}
                label={image.altText ?? `${index + 1}`}
                onMove={(direction) => reorder.mutate(moved(product.images, index, direction))}
              />
              <button
                aria-label={t('admin.common.removeImage')}
                className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                disabled={remove.isPending}
                onClick={() => remove.mutate(image.id)}
                type="button"
              >
                <Icon className="size-4" name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <TextInput label={t('admin.products.altText')} onChange={(e) => setAltText(e.target.value)} value={altText} />
        <div>
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
            <Icon className="size-4" name="plus" /> {upload.isPending ? t('admin.common.uploading') : t('admin.common.uploadImage')}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-500">{t('admin.common.imageHint')}</p>
      {uploadError && (
        <div className="mt-3">
          <Alert>{uploadError}</Alert>
        </div>
      )}
    </Card>
  )
}
