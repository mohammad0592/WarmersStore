import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export interface CustomItem {
  productId: number
  quantity: number
}

/**
 * A cart line holds identifiers and quantities only. Names are kept for display while a quote
 * loads; prices are never stored here, because the server prices every request (M2).
 */
export type CartLine =
  | { lineId: string; kind: 'ReadyMade'; packageId: number; quantity: number; name: string }
  | { lineId: string; kind: 'Custom'; items: CustomItem[] }

export const MAX_LINE_QUANTITY = 99
const MAX_ITEM_QUANTITY = 999
const MAX_LINES = 30

interface CartState {
  lines: CartLine[]
  addReadyMade: (packageId: number, name: string, quantity: number) => void
  setQuantity: (lineId: string, quantity: number) => void
  addCustom: (items: CustomItem[]) => string
  updateCustom: (lineId: string, items: CustomItem[]) => void
  duplicate: (lineId: string) => void
  remove: (lineId: string) => void
  clear: () => void
}

function newLineId() {
  return globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const clampQuantity = (quantity: number, max: number) => Math.min(max, Math.max(1, Math.floor(quantity)))

const cleanItems = (items: CustomItem[]) =>
  items
    .filter((item) => item.quantity > 0)
    .map((item) => ({ productId: item.productId, quantity: clampQuantity(item.quantity, MAX_ITEM_QUANTITY) }))

const isPositiveInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0

/**
 * localStorage is user-editable, so whatever comes back is validated: malformed lines, duplicate
 * line ids and duplicate products inside a custom package are dropped instead of being sent on.
 */
export function sanitizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const lines: CartLine[] = []

  for (const raw of value.slice(0, MAX_LINES)) {
    if (typeof raw !== 'object' || raw === null) continue
    const line = raw as Record<string, unknown>
    if (typeof line.lineId !== 'string' || line.lineId.length === 0 || line.lineId.length > 64 || seen.has(line.lineId)) continue

    if (line.kind === 'ReadyMade' && isPositiveInt(line.packageId) && isPositiveInt(line.quantity)) {
      lines.push({
        lineId: line.lineId,
        kind: 'ReadyMade',
        packageId: line.packageId,
        quantity: Math.min(line.quantity, MAX_LINE_QUANTITY),
        name: typeof line.name === 'string' ? line.name.slice(0, 120) : '',
      })
      seen.add(line.lineId)
    } else if (line.kind === 'Custom' && Array.isArray(line.items)) {
      const productIds = new Set<number>()
      const items: CustomItem[] = []
      for (const item of line.items.slice(0, 20) as Record<string, unknown>[]) {
        if (item && isPositiveInt(item.productId) && isPositiveInt(item.quantity) && !productIds.has(item.productId)) {
          productIds.add(item.productId)
          items.push({ productId: item.productId, quantity: Math.min(item.quantity, MAX_ITEM_QUANTITY) })
        }
      }
      if (items.length > 0) {
        lines.push({ lineId: line.lineId, kind: 'Custom', items })
        seen.add(line.lineId)
      }
    }
  }

  return lines
}

// Private browsing or blocked storage must never break the shop; the cart then lives in memory only.
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // ignore: storage full or unavailable
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      // ignore
    }
  },
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],

      addReadyMade: (packageId, name, quantity) =>
        set(({ lines }) => {
          const existing = lines.find((l) => l.kind === 'ReadyMade' && l.packageId === packageId)
          if (existing && existing.kind === 'ReadyMade') {
            return {
              lines: lines.map((l) =>
                l === existing ? { ...existing, name, quantity: clampQuantity(existing.quantity + quantity, MAX_LINE_QUANTITY) } : l,
              ),
            }
          }
          if (lines.length >= MAX_LINES) return { lines }
          return {
            lines: [...lines, { lineId: newLineId(), kind: 'ReadyMade', packageId, name, quantity: clampQuantity(quantity, MAX_LINE_QUANTITY) }],
          }
        }),

      setQuantity: (lineId, quantity) =>
        set(({ lines }) => ({
          lines:
            quantity <= 0
              ? lines.filter((l) => l.lineId !== lineId)
              : lines.map((l) => (l.lineId === lineId && l.kind === 'ReadyMade' ? { ...l, quantity: clampQuantity(quantity, MAX_LINE_QUANTITY) } : l)),
        })),

      addCustom: (items) => {
        const lineId = newLineId()
        const cleaned = cleanItems(items)
        if (cleaned.length === 0 || get().lines.length >= MAX_LINES) return ''
        set(({ lines }) => ({ lines: [...lines, { lineId, kind: 'Custom', items: cleaned }] }))
        return lineId
      },

      updateCustom: (lineId, items) =>
        set(({ lines }) => {
          const cleaned = cleanItems(items)
          return {
            lines:
              cleaned.length === 0
                ? lines.filter((l) => l.lineId !== lineId)
                : lines.map((l) => (l.lineId === lineId && l.kind === 'Custom' ? { ...l, items: cleaned } : l)),
          }
        }),

      duplicate: (lineId) =>
        set(({ lines }) => {
          const index = lines.findIndex((l) => l.lineId === lineId)
          const original = lines[index]
          if (!original || original.kind !== 'Custom' || lines.length >= MAX_LINES) return { lines }
          const copy: CartLine = { ...original, lineId: newLineId(), items: original.items.map((i) => ({ ...i })) }
          return { lines: [...lines.slice(0, index + 1), copy, ...lines.slice(index + 1)] }
        }),

      remove: (lineId) => set(({ lines }) => ({ lines: lines.filter((l) => l.lineId !== lineId) })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: 'dafa-cart',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ lines: state.lines }),
      merge: (persisted, current) => ({ ...current, lines: sanitizeLines((persisted as { lines?: unknown } | undefined)?.lines) }),
    },
  ),
)

/** Badge count: ready-made quantities plus one per custom package. */
export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + (line.kind === 'ReadyMade' ? line.quantity : 1), 0)
}

/** The request body the checkout API expects for these lines. */
export function toCartRequest(lines: CartLine[]) {
  return lines.map((line) =>
    line.kind === 'ReadyMade'
      ? { lineId: line.lineId, kind: line.kind, packageId: line.packageId, quantity: line.quantity }
      : { lineId: line.lineId, kind: line.kind, items: line.items },
  )
}
