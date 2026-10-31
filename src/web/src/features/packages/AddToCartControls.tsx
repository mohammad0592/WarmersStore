import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { MAX_LINE_QUANTITY, useCart } from '@/features/cart/cartStore'
import { useCartUi } from '@/features/cart/uiStore'
import type { ReadyMadePackage } from '@/lib/api/types'

/** Quantity selector + "أضف للسلة" for a ready-made package card. */
export function AddToCartControls({ item }: { item: ReadyMadePackage }) {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const addReadyMade = useCart((state) => state.addReadyMade)
  const showToast = useCartUi((state) => state.showToast)

  const add = () => {
    addReadyMade(item.id, item.name, quantity)
    showToast(t('cart.added', { name: item.name }))
    setQuantity(1)
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <QuantityStepper
        disabled={!item.isAvailable}
        label={item.name}
        max={MAX_LINE_QUANTITY}
        min={1}
        onChange={setQuantity}
        value={quantity}
      />
      <Button className="flex-1" disabled={!item.isAvailable} onClick={add}>
        <Icon className="size-5" name="cart" /> {t('cart.add')}
      </Button>
    </div>
  )
}
