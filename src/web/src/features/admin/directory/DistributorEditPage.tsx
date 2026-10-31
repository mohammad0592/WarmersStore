import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import { safeExternalUrl } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, adminUpload, problemDetail, validationErrors } from '../adminApi'
import { Alert, Card, ConfirmDialog, PageHeader, SelectInput, TextArea, TextInput, Toggle } from '../components/AdminUi'
import { toNumber } from '../catalog/catalogApi'
import { adminCitiesQuery, adminDistributorQuery, directoryKeys, type AdminCity, type AdminDistributor } from './directoryApi'

interface FormValues {
  name: string
  cityId: string
  address: string
  phoneNumber: string
  googleMapsUrl: string
  latitude: string
  longitude: string
  isActive: boolean
}

function toValues(d: AdminDistributor | undefined): FormValues {
  return {
    name: d?.name ?? '',
    cityId: d ? String(d.cityId) : '',
    address: d?.address ?? '',
    phoneNumber: d?.phoneNumber ?? '',
    googleMapsUrl: d?.googleMapsUrl ?? '',
    latitude: d?.latitude?.toString() ?? '',
    longitude: d?.longitude?.toString() ?? '',
    isActive: d?.isActive ?? false,
  }
}

export function DistributorEditPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const distributorId = id === undefined ? null : Number(id)
  const distributor = useQuery({ ...adminDistributorQuery(distributorId ?? 0), enabled: distributorId !== null })
  const cities = useQuery(adminCitiesQuery)
  useDocumentTitle(distributorId === null ? t('admin.distributors.new') : (distributor.data?.name ?? t('admin.distributors.edit')))

  if ((distributorId !== null && distributor.isPending) || cities.isPending) {
    return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" role="status" />
  }
  if ((distributorId !== null && distributor.isError) || cities.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void distributor.refetch()
          void cities.refetch()
        }}
      />
    )
  }
  return <DistributorForm cities={cities.data} distributor={distributor.data} key={distributor.data?.id ?? 'new'} />
}

function DistributorForm({ distributor, cities }: { distributor: AdminDistributor | undefined; cities: AdminCity[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string; conflict?: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { register, handleSubmit, setError, formState, reset, control } = useForm<FormValues>({ defaultValues: toValues(distributor) })
  const errors = formState.errors
  const mapsUrl = safeExternalUrl(useWatch({ control, name: 'googleMapsUrl' }).trim())

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: directoryKeys.distributors, exact: true })
    void queryClient.invalidateQueries({ queryKey: directoryKeys.cities })
    void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
  }

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = {
        name: v.name,
        cityId: toNumber(v.cityId),
        address: v.address,
        phoneNumber: v.phoneNumber,
        googleMapsUrl: v.googleMapsUrl,
        latitude: toNumber(v.latitude),
        longitude: toNumber(v.longitude),
        isActive: v.isActive,
        version: distributor?.version ?? null,
      }
      return distributor
        ? adminRequest<AdminDistributor>('PUT', `/api/admin/distributors/${distributor.id}`, body)
        : adminRequest<AdminDistributor>('POST', '/api/admin/distributors', body)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(directoryKeys.distributor(saved.id), saved)
      refreshLists()
      if (!distributor) navigate(`/admin/distributors/${saved.id}`, { replace: true })
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
    mutationFn: () => adminRequest<void>('DELETE', `/api/admin/distributors/${distributor!.id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: directoryKeys.distributor(distributor!.id) })
      refreshLists()
      navigate('/admin/distributors', { replace: true })
    },
  })

  const reload = async () => {
    const fresh = await queryClient.fetchQuery({ ...adminDistributorQuery(distributor!.id), staleTime: 0 })
    setStatus(null)
    reset(toValues(fresh))
  }

  return (
    <>
      <PageHeader title={distributor ? distributor.name : t('admin.distributors.new')}>
        <Link className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-white" to="/admin/distributors">
          {t('admin.common.back')}
        </Link>
      </PageHeader>

      <form className="space-y-5" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Card title={t('admin.distributors.basics')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput error={errors.name?.message} label={t('admin.distributors.name')} required {...register('name')} />
            <SelectInput error={errors.cityId?.message} label={t('admin.distributors.city')} required {...register('cityId')}>
              <option value="">{t('admin.distributors.chooseCity')}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
            <div className="sm:col-span-2">
              <TextArea error={errors.address?.message} hint={t('admin.distributors.addressHint')} label={t('admin.distributors.address')} required {...register('address')} />
            </div>
            <TextInput
              autoComplete="off"
              dir="ltr"
              error={errors.phoneNumber?.message}
              hint={t('admin.distributors.phoneHint')}
              inputMode="tel"
              label={t('admin.distributors.phone')}
              {...register('phoneNumber')}
            />
          </div>
        </Card>

        <Card title={t('admin.distributors.location')}>
          <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.distributors.locationHint')}</p>
          <div className="grid gap-4">
            <div>
              <TextInput dir="ltr" error={errors.googleMapsUrl?.message} hint={t('admin.distributors.mapsUrlHint')} label={t('admin.distributors.mapsUrl')} {...register('googleMapsUrl')} />
              {mapsUrl && (
                <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:underline" href={mapsUrl} rel="noopener noreferrer" target="_blank">
                  <Icon className="size-3.5" name="map-pin" /> {t('admin.distributors.testLink')}
                </a>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput dir="ltr" error={errors.latitude?.message} inputMode="decimal" label={t('admin.distributors.latitude')} {...register('latitude')} />
              <TextInput dir="ltr" error={errors.longitude?.message} inputMode="decimal" label={t('admin.distributors.longitude')} {...register('longitude')} />
            </div>
          </div>
        </Card>

        <Card title={t('admin.distributors.visibility')}>
          <Toggle label={t('admin.distributors.isActive')} {...register('isActive')} />
          {errors.isActive?.message && (
            <div className="mt-3">
              <Alert>{errors.isActive.message}</Alert>
            </div>
          )}
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
          {distributor && (
            <Button className="ms-auto text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)} variant="ghost">
              <Icon className="size-4" name="trash" /> {t('admin.common.delete')}
            </Button>
          )}
        </div>
      </form>

      <div className="mt-5">
        {distributor ? (
          <DistributorImage distributor={distributor} onChanged={refreshLists} />
        ) : (
          <Card title={t('admin.distributors.image')}>
            <p className="text-sm text-stone-500">{t('admin.distributors.imageAfterCreate')}</p>
          </Card>
        )}
      </div>

      {distributor && (
        <ConfirmDialog
          busy={remove.isPending}
          confirmLabel={t('admin.common.delete')}
          error={remove.isError ? (problemDetail(remove.error) ?? t('admin.common.error')) : null}
          message={t('admin.distributors.deleteText', { name: distributor.name })}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
          open={confirmDelete}
          title={t('admin.distributors.deleteTitle')}
        />
      )}
    </>
  )
}

function DistributorImage({ distributor, onChanged }: { distributor: AdminDistributor; onChanged: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: directoryKeys.distributor(distributor.id) })
    onChanged()
  }

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return adminUpload<{ imageUrl: string }>('PUT', `/api/admin/distributors/${distributor.id}/image`, form)
    },
    onSuccess: () => {
      if (fileInput.current) fileInput.current.value = ''
      refresh()
    },
  })
  const removeImage = useMutation({
    mutationFn: () => adminRequest<void>('DELETE', `/api/admin/distributors/${distributor.id}/image`),
    onSuccess: refresh,
  })

  return (
    <Card title={t('admin.distributors.image')}>
      <div className="flex flex-wrap items-center gap-4">
        {distributor.imageUrl ? (
          <img alt="" className="h-28 w-44 rounded-xl object-cover" src={distributor.imageUrl} />
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
          {distributor.imageUrl && (
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
