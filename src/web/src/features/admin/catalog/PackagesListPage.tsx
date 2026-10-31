import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ErrorState } from '@/components/ui/States'
import { formatMoney } from '@/lib/format'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { adminKeys, adminRequest } from '../adminApi'
import { PageHeader, ReorderButtons, StatusBadge } from '../components/AdminUi'
import { adminPackagesQuery, moved } from './catalogApi'

export function PackagesListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const packages = useQuery(adminPackagesQuery)
  useDocumentTitle(t('admin.packages.title'))

  const reorder = useMutation({
    mutationFn: (ids: number[]) => adminRequest<void>('PUT', '/api/admin/packages/order', { ids }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.packages }),
  })

  return (
    <>
      <PageHeader title={t('admin.packages.title')}>
        <ButtonLink to="/admin/packages/new">
          <Icon className="size-4" name="plus" /> {t('admin.packages.new')}
        </ButtonLink>
      </PageHeader>

      {packages.isPending ? (
        <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-white" role="status" />
      ) : packages.isError ? (
        <ErrorState onRetry={() => void packages.refetch()} />
      ) : packages.data.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-stone-500">{t('admin.packages.empty')}</p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
          {packages.data.map((item, index) => (
            <li className="flex items-center gap-3 p-3 sm:p-4" key={item.id}>
              <ReorderButtons
                disabled={reorder.isPending}
                isFirst={index === 0}
                isLast={index === packages.data.length - 1}
                label={item.name}
                onMove={(direction) => reorder.mutate(moved(packages.data, index, direction))}
              />
              {item.imageUrl ? (
                <img alt="" className="size-12 shrink-0 rounded-xl object-cover" src={item.imageUrl} />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-300">
                  <Icon className="size-6" name="package" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Link className="font-black hover:text-orange-700" to={`/admin/packages/${item.id}`}>
                  {item.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {formatMoney(item.price)} · {item.items.map((i) => `${i.quantity} × ${i.productName}`).join('، ')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
                {item.isFeatured && (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800">{t('admin.packages.featured')}</span>
                )}
                <StatusBadge active={item.isActive} activeLabel={t('admin.common.active')} inactiveLabel={t('admin.common.inactive')} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
