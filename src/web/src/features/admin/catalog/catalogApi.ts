import { queryOptions } from '@tanstack/react-query'
import type { SellingUnit } from '@/lib/api/types'
import { adminKeys, adminRequest } from '../adminApi'

export interface AdminProductImage {
  id: number
  url: string
  altText: string | null
}

export interface AdminProduct {
  id: number
  slug: string
  name: string
  shortDescription: string | null
  description: string | null
  usageGuidance: string | null
  safetyInfo: string | null
  widthCm: number
  heightCm: number
  heatMinHours: number | null
  heatMaxHours: number | null
  isAdhesive: boolean | null
  piecesPerRetailBag: number
  sellingUnit: SellingUnit
  piecesPerSellingUnit: number
  unitPrice: number | null
  isActive: boolean
  isCustomEligible: boolean
  displayOrder: number
  /** Names of the packages that contain this product (it can't be deleted while non-empty). */
  usedInPackages: string[]
  images: AdminProductImage[]
  version: number
}

export interface AdminPackage {
  id: number
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  regularPrice: number | null
  isActive: boolean
  isFeatured: boolean
  displayOrder: number
  items: { productId: number; productName: string; quantity: number; productActive: boolean; productUnitPrice: number | null }[]
  version: number
}

export const adminProductsQuery = queryOptions({
  queryKey: adminKeys.products,
  queryFn: () => adminRequest<AdminProduct[]>('GET', '/api/admin/products'),
})

export const adminProductQuery = (id: number) =>
  queryOptions({
    queryKey: adminKeys.product(id),
    queryFn: () => adminRequest<AdminProduct>('GET', `/api/admin/products/${id}`),
  })

export const adminPackagesQuery = queryOptions({
  queryKey: adminKeys.packages,
  queryFn: () => adminRequest<AdminPackage[]>('GET', '/api/admin/packages'),
})

export const adminPackageQuery = (id: number) =>
  queryOptions({
    queryKey: adminKeys.package(id),
    queryFn: () => adminRequest<AdminPackage>('GET', `/api/admin/packages/${id}`),
  })

/** Form inputs hold strings; the API wants numbers or null. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace('٫', '.')
  if (text === '') return null
  const number = Number(text)
  return Number.isFinite(number) ? number : NaN
}

/** Moves the item at `index` one place up (-1) or down (+1); returns the new id order. */
export function moved<T extends { id: number }>(items: T[], index: number, direction: -1 | 1): number[] {
  const ids = items.map((item) => item.id)
  const target = index + direction
  if (target < 0 || target >= ids.length) return ids
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  return ids
}
