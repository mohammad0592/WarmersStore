import { queryOptions } from '@tanstack/react-query'
import type { DeliveryMode } from '@/lib/api/types'
import { adminRequest } from '../adminApi'

export type OrderStatus = 'PendingConfirmation' | 'Confirmed' | 'Cancelled' | 'Completed'

export const orderStatuses: OrderStatus[] = ['PendingConfirmation', 'Confirmed', 'Completed', 'Cancelled']

export interface AdminOrderSummary {
  id: number
  reference: string
  status: OrderStatus
  customerName: string
  customerWhatsApp: string
  total: number
  itemCount: number
  createdAt: string
}

export interface AdminOrderPage {
  items: AdminOrderSummary[]
  total: number
  page: number
  pageSize: number
}

export interface AdminOrder {
  id: number
  reference: string
  status: OrderStatus
  statusChangedAt: string
  createdAt: string
  customerName: string
  customerWhatsApp: string
  address: string
  deliveryInstructions: string | null
  notes: string | null
  deliveryMode: DeliveryMode
  deliveryAreaName: string | null
  subtotal: number
  discountTotal: number
  deliveryFee: number
  total: number
  whatsAppMessage: string
  allowedNextStatuses: OrderStatus[]
  items: {
    kind: 'ReadyMade' | 'Custom'
    name: string
    quantity: number
    unitPrice: number | null
    subtotal: number
    discount: number
    lineTotal: number
    products: { productName: string; quantity: number; pieces: number; unitPrice: number | null; subtotal: number | null }[]
  }[]
}

export interface OrderFilters {
  status: OrderStatus | ''
  q: string
  page: number
}

export const orderKeys = {
  all: ['admin', 'orders'] as const,
  list: (f: OrderFilters) => ['admin', 'orders', 'list', f] as const,
  detail: (id: number) => ['admin', 'orders', id] as const,
}

export const adminOrdersQuery = (f: OrderFilters) =>
  queryOptions({
    queryKey: orderKeys.list(f),
    queryFn: () => {
      const params = new URLSearchParams()
      if (f.status) params.set('status', f.status)
      if (f.q.trim()) params.set('q', f.q.trim())
      if (f.page > 1) params.set('page', String(f.page))
      const query = params.toString()
      return adminRequest<AdminOrderPage>('GET', `/api/admin/orders${query ? `?${query}` : ''}`)
    },
    placeholderData: (previous) => previous,
  })

export const adminOrderQuery = (id: number) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: () => adminRequest<AdminOrder>('GET', `/api/admin/orders/${id}`),
  })

const dateFormat = new Intl.DateTimeFormat('ar-PS-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export const statusTone: Record<OrderStatus, string> = {
  PendingConfirmation: 'bg-amber-100 text-amber-900',
  Confirmed: 'bg-sky-100 text-sky-900',
  Completed: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-stone-200 text-stone-600',
}
