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
import { adminProductsQuery, moved, type AdminProduct } from './catalogApi'

export function ProductsListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const products = useQuery(adminProductsQuery)
  useDocumentTitle(t('admin.products.title'))

  const reorder = useMutation({
    mutationFn: (ids: number[]) => adminRequest<void>('PUT', '/api/admin/products/order', { ids }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.products }),
  })

  return (
    <>
      <PageHeader title={t('admin.products.title')}>
        <ButtonLink to="/admin/products/new">
          <Icon className="size-4" name="plus" /> {t('admin.products.new')}
        </ButtonLink>
      </PageHeader>

      {products.isPending ? (
        <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-white" role="status" />
      ) : products.isError ? (
        <ErrorState onRetry={() => void products.refetch()} />
      ) : products.data.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-stone-500">{t('admin.products.empty')}</p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white">
          {products.data.map((product, index) => (
            <li className="flex items-center gap-3 p-3 sm:p-4" key={product.id}>
              <ReorderButtons
                disabled={reorder.isPending}
                isFirst={index === 0}
                isLast={index === products.data.length - 1}
                label={product.name}
                onMove={(direction) => reorder.mutate(moved(products.data, index, direction))}
              />
              <Thumb product={product} />
              <div className="min-w-0 flex-1">
                <Link className="font-black hover:text-orange-700" to={`/admin/products/${product.id}`}>
                  {product.name}
                </Link>
                <p className="mt-0.5 text-xs text-stone-500">
                  {product.unitPrice === null
                    ? t('admin.products.noPrice')
                    : t('admin.products.perUnit', {
                        price: formatMoney(product.unitPrice),
                        unit: product.sellingUnit === 'Piece' ? t('admin.products.unitPiece') : t('admin.products.unitBag'),
                      })}
                  {product.usedInPackages.length > 0 && ` · ${t('admin.products.inPackages', { count: product.usedInPackages.length })}`}
                </p>
              </div>
              <StatusBadge active={product.isActive} activeLabel={t('admin.common.active')} inactiveLabel={t('admin.common.inactive')} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Thumb({ product }: { product: AdminProduct }) {
  const image = product.images[0]
  return image ? (
    <img alt="" className="size-12 shrink-0 rounded-xl object-cover" src={image.url} />
  ) : (
    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-300">
      <Icon className="size-6" name="flame" />
    </span>
  )
}
