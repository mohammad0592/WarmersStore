import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, problemDetail, validationErrors } from '../adminApi'
import { Alert, Card, ConfirmDialog, PageHeader, ReorderButtons, StatusBadge, TextInput, Toggle } from '../components/AdminUi'
import { moved } from '../catalog/catalogApi'
import { adminCitiesQuery, directoryKeys, type AdminCity } from './directoryApi'

export function CitiesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const cities = useQuery(adminCitiesQuery)
  const [toDelete, setToDelete] = useState<AdminCity | null>(null)
  useDocumentTitle(t('admin.cities.title'))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: directoryKeys.cities })
    void queryClient.invalidateQueries({ queryKey: directoryKeys.distributors })
    void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
  }

  const reorder = useMutation({
    mutationFn: (ids: number[]) => adminRequest<void>('PUT', '/api/admin/cities/order', { ids }),
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: number) => adminRequest<void>('DELETE', `/api/admin/cities/${id}`),
    onSuccess: () => {
      setToDelete(null)
      refresh()
    },
  })

  return (
    <>
      <PageHeader title={t('admin.cities.title')} />
      <p className="-mt-3 mb-5 text-sm text-stone-500">{t('admin.cities.intro')}</p>

      <AddCity onAdded={refresh} />

      <div className="mt-5">
        {cities.isPending ? (
          <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-white" role="status" />
        ) : cities.isError ? (
          <ErrorState onRetry={() => void cities.refetch()} />
        ) : cities.data.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-stone-500">{t('admin.cities.empty')}</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
            {cities.data.map((city, index) => (
              <CityRow
                city={city}
                isFirst={index === 0}
                isLast={index === cities.data.length - 1}
                key={city.id}
                onDelete={() => {
                  remove.reset()
                  setToDelete(city)
                }}
                onMove={(direction) => reorder.mutate(moved(cities.data, index, direction))}
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
        message={toDelete ? t('admin.cities.deleteText', { name: toDelete.name }) : ''}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        open={toDelete !== null}
        title={t('admin.cities.deleteTitle')}
      />
    </>
  )
}

function AddCity({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const add = useMutation({
    mutationFn: () => adminRequest<AdminCity>('POST', '/api/admin/cities', { name, slug, isActive: true }),
    onSuccess: () => {
      setName('')
      setSlug('')
      onAdded()
    },
  })
  const errors = validationErrors(add.error)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    add.mutate()
  }

  return (
    <Card title={t('admin.cities.add')}>
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start" noValidate onSubmit={submit}>
        <TextInput error={errors.name} label={t('admin.cities.name')} onChange={(e) => setName(e.target.value)} required value={name} />
        <TextInput dir="ltr" error={errors.slug} hint={t('admin.cities.slugHint')} label={t('admin.cities.slug')} onChange={(e) => setSlug(e.target.value)} required value={slug} />
        <Button className="sm:mt-7" disabled={add.isPending} type="submit">
          <Icon className="size-4" name="plus" /> {t('admin.cities.add')}
        </Button>
      </form>
    </Card>
  )
}

function CityRow({
  city,
  isFirst,
  isLast,
  reordering,
  onMove,
  onDelete,
  onSaved,
}: {
  city: AdminCity
  isFirst: boolean
  isLast: boolean
  reordering: boolean
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(city.name)
  const [slug, setSlug] = useState(city.slug)
  const [isActive, setIsActive] = useState(city.isActive)
  const save = useMutation({
    mutationFn: () => adminRequest<AdminCity>('PUT', `/api/admin/cities/${city.id}`, { name, slug, isActive }),
    onSuccess: () => {
      setEditing(false)
      onSaved()
    },
  })
  const errors = validationErrors(save.error)

  if (editing) {
    return (
      <li className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <TextInput error={errors.name} label={t('admin.cities.name')} onChange={(e) => setName(e.target.value)} required value={name} />
          <TextInput dir="ltr" error={errors.slug} label={t('admin.cities.slug')} onChange={(e) => setSlug(e.target.value)} required value={slug} />
          <Toggle checked={isActive} label={t('admin.cities.isActive')} onChange={(e) => setIsActive(e.target.checked)} />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button onClick={() => setEditing(false)} variant="ghost">
              {t('admin.common.cancel')}
            </Button>
            <Button disabled={save.isPending} type="submit">
              {t('admin.common.save')}
            </Button>
          </div>
          {save.isError && !Object.keys(errors).length && (
            <div className="sm:col-span-2">
              <Alert>{t('admin.common.error')}</Alert>
            </div>
          )}
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 p-3 sm:p-4">
      <ReorderButtons disabled={reordering} isFirst={isFirst} isLast={isLast} label={city.name} onMove={onMove} />
      <div className="min-w-0 flex-1">
        <p className="font-black">{city.name}</p>
        <p className="text-xs text-stone-500">
          <bdi dir="ltr">{city.slug}</bdi> · {t('admin.cities.counts', { total: city.distributorCount, active: city.activeDistributorCount })}
        </p>
      </div>
      <StatusBadge active={city.isActive} activeLabel={t('admin.common.active')} inactiveLabel={t('admin.common.inactive')} />
      <button
        aria-label={`${t('admin.common.edit')} ${city.name}`}
        className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
        onClick={() => setEditing(true)}
        type="button"
      >
        <Icon className="size-4" name="edit" />
      </button>
      <button
        aria-label={`${t('admin.common.delete')} ${city.name}`}
        className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
        onClick={onDelete}
        type="button"
      >
        <Icon className="size-4" name="trash" />
      </button>
    </li>
  )
}
