import { useEffect } from 'react'

const siteTitle = 'دفا | منتجات تدفئة عملية'

/** Sets the browser tab title for the current page ("منتجاتنا | دفا"); the home page passes nothing. */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} | دفا` : siteTitle
  }, [title])
}
