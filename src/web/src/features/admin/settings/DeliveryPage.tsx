import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import type { DeliveryMode } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminRequest, problemDetail, validationErrors } from '../adminApi'
import { Alert, Card, ConfirmDialog, PageHeader, ReorderButtons, SelectInput, StatusBadge, TextInput, Toggle } from '../components/AdminUi'
import { moved, toNumber } from '../catalog/catalogApi'
import { adminAreasQuery, adminDeliveryQuery, settingsKeys, type AdminDeliveryArea, type AdminDeliverySettings } from './settingsApi'

const DELIVERY_OPTIONS_KEY = ['delivery-options']

interface SettingsValues {
  mode: DeliveryMode
  flatFee: string
  freeDeliveryThreshold: string
  message: string
}

function toValues(s: AdminDeliverySettings): SettingsValues {
  return { mode: s.mode, flatFee: s.flatFee?.toString() ?? '', freeDeliveryThreshold: s.freeDeliveryThreshold?.toString() ?? '', message: s.message ?? '' }
}

export function DeliveryPage() {
  const { t } = useTranslation()
  const settings = useQuery(adminDeliveryQuery)
  useDocumentTitle(t('admin.delivery.title'))

  return (
    <>
      <PageHeader title={t('admin.delivery.title')} />
      <p className="-mt-3 mb-5 text-sm text-stone-500">{t('admin.delivery.intro')}</p>
      {settings.isPending ? (
        <div aria-busy="true" className="h-60 animate-pulse rounded-2xl bg-white" role="status" />
      ) : settings.isError ? (
        <ErrorState onRetry={() => void settings.refetch()} />
      ) : (
        <DeliverySettingsForm settings={settings.data} />
      )}
      <div className="mt-5">
        <DeliveryAreas />
      </div>
    </>
  )
}

function DeliverySettingsForm({ settings }: { settings: AdminDeliverySettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)
  const { register, handleSubmit, setError, formState, reset, control } = useForm<SettingsValues>({ defaultValues: toValues(settings) })
  const errors = formState.errors
  const mode = useWatch({ control, name: 'mode' })

  const save = useMutation({
    mutationFn: (v: SettingsValues) =>
      adminRequest<AdminDeliverySettings>('PUT', '/api/admin/delivery-settings', {
        mode: v.mode,
        flatFee: v.mode === 'Flat' ? toNumber(v.flatFee) : null,
        freeDeliveryThreshold: v.mode === 'Flat' ? toNumber(v.freeDeliveryThreshold) : null,
        message: v.message,
      }),
    onSuccess: (saved) => {
      reset(toValues(saved))
      setStatus({ tone: 'success', message: t('admin.common.saved') })
      queryClient.setQueryData(settingsKeys.delivery, saved)
      void queryClient.invalidateQueries({ queryKey: DELIVERY_OPTIONS_KEY })
    },
    onError: (error) => {
      const fields = validationErrors(error)
      Object.entries(fields).forEach(([key, message]) => setError(key as keyof SettingsValues, { message }))
      setStatus({ tone: 'error', message: Object.keys(fields).length ? t('admin.common.fixErrors') : t('admin.common.error') })
    },
  })

  return (
    <Card title={t('admin.delivery.settings')}>
      <form className="grid gap-4" noValidate onSubmit={handleSubmit((values) => save.mutate(values))}>
        <SelectInput error={errors.mode?.message} label={t('admin.delivery.mode')} {...register('mode')}>
          <option value="None">{t('admin.delivery.modes.None')}</option>
          <option value="Flat">{t('admin.delivery.modes.Flat')}</option>
          <option value="PerArea">{t('admin.delivery.modes.PerArea')}</option>
        </SelectInput>
        <p className="-mt-2 text-xs text-stone-500">{t(`admin.delivery.modeHints.${mode}`)}</p>
        {mode === 'Flat' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput dir="ltr" error={errors.flatFee?.message} inputMode="decimal" label={t('admin.delivery.flatFee')} required {...register('flatFee')} />
            <TextInput
              dir="ltr"
              error={errors.freeDeliveryThreshold?.message}
              hint={t('admin.delivery.freeOverHint')}
              inputMode="decimal"
              label={t('admin.delivery.freeOver')}
              {...register('freeDeliveryThreshold')}
            />
          </div>
        )}
        <TextInput error={errors.message?.message} hint={t('admin.delivery.messageHint')} label={t('admin.delivery.message')} maxLength={300} {...register('message')} />
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
          {status && <Alert tone={status.tone}>{status.message}</Alert>}
        </div>
      </form>
    </Card>
  )
}

interface AreaValues {
  name: string
  fee: string
  freeDeliveryThreshold: string
  note: string
  isActive: boolean
}

const areaBody = (v: AreaValues) => ({ name: v.name, fee: toNumber(v.fee), freeDeliveryThreshold: toNumber(v.freeDeliveryThreshold), note: v.note, isActive: v.isActive })

function DeliveryAreas() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const areas = useQuery(adminAreasQuery)
  const [toDelete, setToDelete] = useState<AdminDeliveryArea | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: settingsKeys.areas })
    void queryClient.invalidateQueries({ queryKey: DELIVERY_OPTIONS_KEY })
  }
  const reorder = useMutation({
    mutationFn: (ids: number[]) => adminRequest<void>('PUT', '/api/admin/delivery-areas/order', { ids }),
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: number) => adminRequest<void>('DELETE', `/api/admin/delivery-areas/${id}`),
    onSuccess: () => {
      setToDelete(null)
      refresh()
    },
  })

  return (
    <Card title={t('admin.delivery.areas')}>
      <p className="-mt-2 mb-4 text-xs text-stone-500">{t('admin.delivery.areasHint')}</p>
      <AreaForm onDone={refresh} />
      <div className="mt-4">
        {areas.isPending ? (
          <div aria-busy="true" className="h-24 animate-pulse rounded-xl bg-stone-50" role="status" />
        ) : areas.isError ? (
          <ErrorState onRetry={() => void areas.refetch()} />
        ) : areas.data.length === 0 ? (
          <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">{t('admin.delivery.noAreas')}</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100">
            {areas.data.map((area, index) => (
              <AreaRow
                area={area}
                isFirst={index === 0}
                isLast={index === areas.data.length - 1}
                key={area.id}
                onDelete={() => {
                  remove.reset()
                  setToDelete(area)
                }}
                onMove={(direction) => reorder.mutate(moved(areas.data, index, direction))}
                onSaved={refresh}
                reordering={reorder.isPending}
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        busy={remove.isPending}
        confirmLabel={t('admin.common.delete')}
        error={remove.isError ? (problemDetail(remove.error) ?? t('admin.common.error')) : null}
        message={toDelete ? t('admin.delivery.deleteText', { name: toDelete.name }) : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        open={toDelete !== null}
        title={t('admin.delivery.deleteTitle')}
      />
    </Card>
  )
}

/** Adds an area, or edits one when `area` is given. */
function AreaForm({ area, onDone, onCancel }: { area?: AdminDeliveryArea; onDone: () => void; onCancel?: () => void }) {
  const { t } = useTranslation()
  const empty: AreaValues = { name: '', fee: '', freeDeliveryThreshold: '', note: '', isActive: true }
  const [values, setValues] = useState<AreaValues>(
    area ? { name: area.name, fee: String(area.fee), freeDeliveryThreshold: area.freeDeliveryThreshold?.toString() ?? '', note: area.note ?? '', isActive: area.isActive } : empty,
  )
  const save = useMutation({
    mutationFn: () =>
      area
        ? adminRequest<AdminDeliveryArea>('PUT', `/api/admin/delivery-areas/${area.id}`, areaBody(values))
        : adminRequest<AdminDeliveryArea>('POST', '/api/admin/delivery-areas', areaBody(values)),
    onSuccess: () => {
      if (!area) setValues(empty)
      onDone()
    },
  })
  const errors = validationErrors(save.error)
  const set = (key: keyof AreaValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form className="grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-4" noValidate onSubmit={submit}>
      <TextInput error={errors.name} label={t('admin.delivery.areaName')} onChange={set('name')} required value={values.name} />
      <TextInput dir="ltr" error={errors.fee} inputMode="decimal" label={t('admin.delivery.areaFee')} onChange={set('fee')} required value={values.fee} />
      <TextInput dir="ltr" error={errors.freeDeliveryThreshold} inputMode="decimal" label={t('admin.delivery.freeOver')} onChange={set('freeDeliveryThreshold')} value={values.freeDeliveryThreshold} />
      <TextInput error={errors.note} label={t('admin.delivery.areaNote')} maxLength={200} onChange={set('note')} value={values.note} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Toggle checked={values.isActive} label={t('admin.common.active')} onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))} />
        <div className="ms-auto flex gap-2">
          {onCancel && (
            <Button onClick={onCancel} variant="ghost">
              {t('admin.common.cancel')}
            </Button>
          )}
          <Button disabled={save.isPending} type="submit">
            {area ? (
              t('admin.common.save')
            ) : (
              <>
                <Icon className="size-4" name="plus" /> {t('admin.delivery.addArea')}
              </>
            )}
          </Button>
        </div>
      </div>
      {save.isError && !Object.keys(errors).length && (
        <div className="sm:col-span-2 lg:col-span-4">
          <Alert>{t('admin.common.error')}</Alert>
        </div>
      )}
    </form>
  )
}

function AreaRow({
  area,
  isFirst,
  isLast,
  reordering,
  onMove,
  onDelete,
  onSaved,
}: {
  area: AdminDeliveryArea
  isFirst: boolean
  isLast: boolean
  reordering: boolean
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="p-3">
        <AreaForm
          area={area}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false)
            onSaved()
          }}
        />
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <ReorderButtons disabled={reordering} isFirst={isFirst} isLast={isLast} label={area.name} onMove={onMove} />
      <div className="min-w-0 flex-1">
        <p className="font-black">{area.name}</p>
        <p className="text-xs text-stone-500">
          {t('admin.delivery.feeLine', { fee: formatMoney(area.fee) })}
          {area.freeDeliveryThreshold !== null && ` · ${t('admin.delivery.freeOverLine', { amount: formatMoney(area.freeDeliveryThreshold) })}`}
          {area.note && ` · ${area.note}`}
        </p>
      </div>
      <StatusBadge active={area.isActive} activeLabel={t('admin.common.active')} inactiveLabel={t('admin.common.inactive')} />
      <button
        aria-label={`${t('admin.common.edit')} ${area.name}`}
        className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
        onClick={() => setEditing(true)}
        type="button"
      >
        <Icon className="size-4" name="edit" />
      </button>
      <button
        aria-label={`${t('admin.common.delete')} ${area.name}`}
        className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
        onClick={onDelete}
        type="button"
      >
        <Icon className="size-4" name="trash" />
      </button>
    </li>
  )
}
