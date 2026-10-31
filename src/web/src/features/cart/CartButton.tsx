import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/Icon'
import { cartCount, useCart } from './cartStore'
import { useCartUi } from './uiStore'

export function CartButton() {
  const { t } = useTranslation()
  const count = useCart((state) => cartCount(state.lines))
  const openCart = useCartUi((state) => state.openCart)

  return (
    <button
      aria-haspopup="dialog"
      aria-label={count > 0 ? t('cart.openWithCount', { count }) : t('cart.open')}
      className="relative grid size-11 place-items-center rounded-xl border border-stone-200 bg-white transition hover:border-orange-300 hover:text-orange-700"
      onClick={openCart}
      type="button"
    >
      <Icon className="size-5" name="cart" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-black text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
