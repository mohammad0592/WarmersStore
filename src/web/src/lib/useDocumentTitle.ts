import { useEffect } from 'react'

const siteTitle = 'دفا | منتجات تدفئة عملية'

/**
 * Sets the browser tab title for the current page ("منتجاتنا | دفا"); the home page passes nothing.
 * `enabled: false` lets a page step aside while a dialog on top of it owns the title.
 */
export function useDocumentTitle(title?: string | null, enabled = true) {
  useEffect(() => {
    if (enabled) document.title = title ? `${title} | دفا` : siteTitle
  }, [title, enabled])
}
