import { queryOptions } from '@tanstack/react-query'
import type { DeliveryMode } from '@/lib/api/types'
import { adminRequest } from '../adminApi'

export interface AdminStoreSettings {
  storeName: string
  logoUrl: string | null
  whatsAppNumber: string | null
  phone: string | null
  email: string | null
  address: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  tikTokUrl: string | null
  announcement: string | null
  announcementActive: boolean
  minOrderTotal: number | null
  showDistributors: boolean
  heroTitle: string | null
  heroDescription: string | null
  whereToFindText: string | null
}

export type DiscountType = 'Percent' | 'Fixed'

export interface AdminCustomRules {
  isEnabled: boolean
  minItems: number | null
  maxItems: number | null
  minSubtotal: number | null
  maxQuantityPerProduct: number | null
  productRules: { productId: number; productName: string; minQty: number | null; maxQty: number | null }[]
  discountTiers: { minItems: number; type: DiscountType; value: number; isActive: boolean }[]
}

export interface AdminDeliverySettings {
  mode: DeliveryMode
  flatFee: number | null
  freeDeliveryThreshold: number | null
  message: string | null
}

export interface AdminDeliveryArea {
  id: number
  name: string
  fee: number
  freeDeliveryThreshold: number | null
  note: string | null
  isActive: boolean
  displayOrder: number
}

export const settingsKeys = {
  store: ['admin', 'store-settings'] as const,
  customRules: ['admin', 'custom-package-rules'] as const,
  delivery: ['admin', 'delivery-settings'] as const,
  areas: ['admin', 'delivery-areas'] as const,
}

export const adminStoreSettingsQuery = queryOptions({
  queryKey: settingsKeys.store,
  queryFn: () => adminRequest<AdminStoreSettings>('GET', '/api/admin/store-settings'),
})

export const adminCustomRulesQuery = queryOptions({
  queryKey: settingsKeys.customRules,
  queryFn: () => adminRequest<AdminCustomRules>('GET', '/api/admin/custom-package-rules'),
})

export const adminDeliveryQuery = queryOptions({
  queryKey: settingsKeys.delivery,
  queryFn: () => adminRequest<AdminDeliverySettings>('GET', '/api/admin/delivery-settings'),
})

export const adminAreasQuery = queryOptions({
  queryKey: settingsKeys.areas,
  queryFn: () => adminRequest<AdminDeliveryArea[]>('GET', '/api/admin/delivery-areas'),
})
