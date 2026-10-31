import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { storeSettingsQuery } from '@/features/settings/useStoreSettings'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, adminUpload, validationErrors } from '../adminApi'
import { Alert, Card, PageHeader, TextArea, TextInput, Toggle } from '../components/AdminUi'
import { toNumber } from '../catalog/catalogApi'
import { adminStoreSettingsQuery, settingsKeys, type AdminStoreSettings } from './settingsApi'

interface FormValues {
  storeName: string
  whatsAppNumber: string
  phone: string
  email: string
  address: string
  facebookUrl: string
  instagramUrl: string
  tikTokUrl: string
  announcement: string
  announcementActive: boolean
  minOrderTotal: string
  showDistributors: boolean
  heroTitle: string
  heroDescription: string
  whereToFindText: string
}

function toValues(s: AdminStoreSettings): FormValues {
  return {
    storeName: s.storeName,
    whatsAppNumber: s.whatsAppNumber ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    address: s.address ?? '',
    facebookUrl: s.facebookUrl ?? '',
    instagramUrl: s.instagramUrl ?? '',
    tikTokUrl: s.tikTokUrl ?? '',
    announcement: s.announcement ?? '',
    announcementActive: s.announcementActive,
    minOrderTotal: s.minOrderTotal?.toString() ?? '',
    showDistributors: s.showDistributors,
    heroTitle: s.heroTitle ?? '',
    heroDescription: s.heroDescription ?? '',
    whereToFindText: s.whereToFindText ?? '',
  }
}

export function StoreSettingsPage() {
  const { t } = useTranslation()
  const settings = useQuery(adminStoreSettingsQuery)
  useDocumentTitle(t('admin.settings.title'))

  if (settings.isPending) return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" role="status" />
  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} />
  return (
    <>
      <PageHeader title={t('admin.settings.title')} />
      <StoreSettingsForm settings={settings.data} />
      <div className="mt-5">
        <LogoCard logoUrl={settings.data.logoUrl} />
      </div>
    </>
  )
}

/** Refresh both the admin copy and the public settings the storefront (and admin header) read. */
function useRefreshSettings() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: settingsKeys.store })
    void queryClient.invalidateQueries({ queryKey: storeSettingsQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
  }
}

function StoreSettingsForm({ settings }: { settings: AdminStoreSettings }) {
  const { t } = useTranslation()
  const refresh = useRefreshSettings()
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)
  const { register, handleSubmit, setError, formState, reset } = useForm<FormValues>({ defaultValues: toValues(settings) })
  const errors = formState.errors

  const save = useMutation({
    mutationFn: (v: FormValues) => adminRequest<AdminStoreSettings>('PUT', '/api/admin/store-settings', { ...v, minOrderTotal: toNumber(v.minOrderTotal) }),
    onSuccess: (saved) => {
      reset(toValues(saved))
      setStatus({ tone: 'success', message: t('admin.common.saved') })
      refresh()
    },
    onError: (error) => {
      const fields = validationErrors(error)
      Object.entries(fields).forEach(([key, message]) => setError(key as keyof FormValues, { message }))
      setStatus({ tone: 'error', message: Object.keys(fields).length ? t('admin.common.fixErrors') : t('admin.common.error') })
    },
  })

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
      <Card title={t('admin.settings.ordering')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput error={errors.storeName?.message} label={t('admin.settings.storeName')} required {...register('storeName')} />
          <TextInput
            autoComplete="off"
            dir="ltr"
            error={errors.whatsAppNumber?.message}
            hint={t('admin.settings.whatsAppHint')}
            inputMode="tel"
            label={t('admin.settings.whatsApp')}
            {...register('whatsAppNumber')}
          />
          <TextInput
            dir="ltr"
            error={errors.minOrderTotal?.message}
            hint={t('admin.settings.minOrderHint')}
            inputMode="decimal"
            label={t('admin.settings.minOrder')}
            {...register('minOrderTotal')}
          />
        </div>
      </Card>

      <Card title={t('admin.settings.distributors')}>
        <Toggle hint={t('admin.settings.showDistributorsHint')} label={t('admin.settings.showDistributors')} {...register('showDistributors')} />
      </Card>

      <Card title={t('admin.settings.announcementTitle')}>
        <div className="grid gap-4">
          <TextInput error={errors.announcement?.message} label={t('admin.settings.announcement')} maxLength={200} {...register('announcement')} />
          <Toggle label={t('admin.settings.announcementActive')} {...register('announcementActive')} />
        </div>
      </Card>

      <Card title={t('admin.settings.homepage')}>
        <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.settings.homepageHint')}</p>
        <div className="grid gap-4">
          <TextInput error={errors.heroTitle?.message} label={t('admin.settings.heroTitle')} maxLength={80} placeholder={t('home.title')} {...register('heroTitle')} />
          <TextArea error={errors.heroDescription?.message} label={t('admin.settings.heroDescription')} maxLength={300} placeholder={t('home.description')} {...register('heroDescription')} />
          <TextArea error={errors.whereToFindText?.message} label={t('admin.settings.whereToFindText')} maxLength={300} placeholder={t('home.whereToFind.text')} {...register('whereToFindText')} />
        </div>
      </Card>

      <Card title={t('admin.settings.contact')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput autoComplete="off" dir="ltr" error={errors.phone?.message} inputMode="tel" label={t('admin.settings.phone')} {...register('phone')} />
          <TextInput autoComplete="off" dir="ltr" error={errors.email?.message} inputMode="email" label={t('admin.settings.email')} {...register('email')} />
          <div className="sm:col-span-2">
            <TextInput error={errors.address?.message} label={t('admin.settings.address')} {...register('address')} />
          </div>
          <TextInput dir="ltr" error={errors.facebookUrl?.message} label={t('admin.settings.facebook')} placeholder="https://" {...register('facebookUrl')} />
          <TextInput dir="ltr" error={errors.instagramUrl?.message} label={t('admin.settings.instagram')} placeholder="https://" {...register('instagramUrl')} />
          <TextInput dir="ltr" error={errors.tikTokUrl?.message} label={t('admin.settings.tikTok')} placeholder="https://" {...register('tikTokUrl')} />
        </div>
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

function LogoCard({ logoUrl }: { logoUrl: string | null }) {
  const { t } = useTranslation()
  const refresh = useRefreshSettings()
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return adminUpload<{ logoUrl: string }>('PUT', '/api/admin/store-settings/logo', form)
    },
    onSuccess: () => {
      if (fileInput.current) fileInput.current.value = ''
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: () => adminRequest<void>('DELETE', '/api/admin/store-settings/logo'),
    onSuccess: refresh,
  })

  return (
    <Card title={t('admin.settings.logo')}>
      <div className="flex flex-wrap items-center gap-4">
        {logoUrl ? (
          <img alt="" className="size-24 rounded-xl bg-stone-50 object-contain" src={logoUrl} />
        ) : (
          <span className="grid size-24 place-items-center rounded-xl bg-orange-50 text-center text-xs text-orange-300">{t('admin.common.noImage')}</span>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('admin.settings.uploadLogo')}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate(file)
            }}
            ref={fileInput}
            type="file"
          />
          <Button disabled={upload.isPending} onClick={() => fileInput.current?.click()} variant="secondary">
            {upload.isPending ? t('admin.common.uploading') : t('admin.settings.uploadLogo')}
          </Button>
          {logoUrl && (
            <Button className="text-red-600" disabled={remove.isPending} onClick={() => remove.mutate()} variant="ghost">
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
