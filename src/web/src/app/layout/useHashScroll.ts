import { useEffect } from 'react'
import { useLocation } from 'react-router'

/**
 * React Router doesn't scroll to #anchors on client-side navigation (e.g. "/packages#custom").
 * Scrolls once the target exists; data-driven sections may render a moment later.
 */
export function useHashScroll() {
  const { hash, key } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    let attempts = 0
    const timer = window.setInterval(() => {
      const element = document.getElementById(id)
      if (element || ++attempts > 20) {
        window.clearInterval(timer)
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [hash, key])
}
