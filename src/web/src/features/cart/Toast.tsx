import { useEffect } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useCartUi } from './uiStore'

/** Short confirmation after adding to the cart (design: dark pill, bottom centre). */
export function Toast() {
  const toast = useCartUi((state) => state.toast)
  const dismiss = useCartUi((state) => state.dismissToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(dismiss, 2400)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4" role="status">
      {toast && (
        <div className="flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm font-bold text-white shadow-2xl" key={toast.id}>
          <span className="grid size-6 place-items-center rounded-full bg-emerald-500">
            <Icon className="size-4" name="check" />
          </span>
          {toast.message}
        </div>
      )}
    </div>
  )
}
