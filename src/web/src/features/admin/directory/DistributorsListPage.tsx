import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest, validationErrors } from '../adminApi'
import { Alert, PageHeader, ReorderButtons } from '../components/AdminUi'
import { moved } from '../catalog/catalogApi'
import { adminCitiesQuery, adminDistributorsQuery, directoryKeys, type AdminDistributor } from './directoryApi'

// Compact selects for the filter bar (the form inputClass is full width).
const filterClass =
  'min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100'

export function DistributorsListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const distributors = useQuery(adminDistributorsQuery)
  const cities = useQuery(adminCitiesQuery)
  const [cityId, setCityId] = useState<number | null>(null)
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  useDocumentTitle(t('admin.distributors.title'))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: directoryKeys.distributors })
    void queryClient.invalidateQueries({ queryKey: directoryKeys.cities })
    void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
  }

  const toggle = useMutation({
    mutationFn: (d: AdminDistributor) => adminRequest<AdminDistributor>('PATCH', `/api/admin/distributors/${d.id}/status`, { isActive: !d.isActive }),
    onSettled: refresh,
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => adminRequest<void>('PUT', '/api/admin/distributors/order', { cityId, ids }),
    onSettled: refresh,
  })

  const visible = (distributors.data ?? []).filter(
    (d) => (cityId === null || d.cityId === cityId) && (status === 'all' || d.isActive === (status === 'active')),
  )
  const canReorder = cityId !== null && status === 'all'
  const toggleError = toggle.isError ? (validationErrors(toggle.error).isActive ?? t('admin.common.error')) : null

  return (
    <>
      <PageHeader title={t('admin.distributors.title')}>
        {(cities.data?.length ?? 0) > 0 && (
          <ButtonLink to="/admin/distributors/new">
            <Icon className="size-4" name="plus" /> {t('admin.distributors.new')}
          </ButtonLink>
        )}
      </PageHeader>
      <p className="-mt-3 mb-5 text-sm text-stone-500">{t('admin.distributors.inStoreNote')}</p>

      {cities.data?.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center">
          <p className="text-stone-600">{t('admin.distributors.noCities')}</p>
          <ButtonLink className="mt-4" to="/admin/cities">
            {t('admin.distributors.goToCities')}
          </ButtonLink>
        </div>
      ) : distributors.isPending || cities.isPending ? (
        <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-white" role="status" />
      ) : distributors.isError || cities.isError ? (
        <ErrorState
          onRetry={() => {
            void distributors.refetch()
            void cities.refetch()
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              aria-label={t('admin.distributors.filterCity')}
              className={filterClass}
              onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : null)}
              value={cityId ?? ''}
            >
              <option value="">{t('admin.distributors.allCities')}</option>
              {cities.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t('admin.distributors.filterStatus')}
              className={filterClass}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              value={status}
            >
              <option value="all">{t('admin.distributors.allStatuses')}</option>
              <option value="active">{t('admin.common.active')}</option>
              <option value="inactive">{t('admin.common.inactive')}</option>
            </select>
            {!canReorder && <p className="self-center text-xs text-stone-500">{t('admin.distributors.reorderHint')}</p>}
          </div>

          {toggleError && (
            <div className="mb-4">
              <Alert>{toggleError}</Alert>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-stone-500">{t('admin.distributors.empty')}</p>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
              {visible.map((d, index) => (
                <li className="flex items-center gap-3 p-3 sm:p-4" key={d.id}>
                  {canReorder && (
                    <ReorderButtons
                      disabled={reorder.isPending}
                      isFirst={index === 0}
                      isLast={index === visible.length - 1}
                      label={d.name}
                      onMove={(direction) => reorder.mutate(moved(visible, index, direction))}
                    />
                  )}
                  {d.imageUrl ? (
                    <img alt="" className="size-12 shrink-0 rounded-xl object-cover" src={d.imageUrl} />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-300">
                      <Icon className="size-6" name="map-pin" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link className="font-black hover:text-orange-700" to={`/admin/distributors/${d.id}`}>
                      {d.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {d.cityName} · {d.address}
                    </p>
                    <p className={`mt-0.5 text-xs font-bold ${d.mapUrl ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {d.mapUrl ? t('admin.distributors.hasLocation') : t('admin.distributors.noLocation')}
                    </p>
                  </div>
                  <button
                    aria-label={d.isActive ? t('admin.distributors.deactivate', { name: d.name }) : t('admin.distributors.activate', { name: d.name })}
                    aria-pressed={d.isActive}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      d.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                    }`}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(d)}
                    type="button"
                  >
                    {d.isActive ? t('admin.common.active') : t('admin.common.inactive')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
