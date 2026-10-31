/**
 * Leaving the site for an external app (WhatsApp). Uses location.assign rather than window.open:
 * after an awaited request, mobile browsers block window.open as an unrequested pop-up.
 * Kept in an object so tests can replace it.
 */
export const browser = {
  open(url: string) {
    window.location.assign(url)
  },
}

const LAST_ORDER_KEY = 'dafa-last-order'

export interface LastOrder {
  reference: string
  whatsAppUrl: string
}

/** The just-submitted order, kept for this tab so the "sent" page survives a reload or Back. */
export const lastOrder = {
  save(order: LastOrder) {
    try {
      window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order))
    } catch {
      // storage unavailable: the sent page falls back to a generic message
    }
  },
  load(): LastOrder | null {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(LAST_ORDER_KEY) ?? 'null') as Partial<LastOrder> | null
      return value && typeof value.reference === 'string' && typeof value.whatsAppUrl === 'string' && value.whatsAppUrl.startsWith('https://wa.me/')
        ? { reference: value.reference, whatsAppUrl: value.whatsAppUrl }
        : null
    } catch {
      return null
    }
  },
}
