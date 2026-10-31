import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** What is being counted, e.g. the product name; read out by screen readers. */
  label: string
  disabled?: boolean
}

/**
 * −/+ control from the design. Laid out left-to-right (− 1 +) even in RTL, as in the Figma file,
 * so the minus button always sits on the left.
 */
export function QuantityStepper({ value, onChange, min = 0, max = 99, label, disabled = false }: QuantityStepperProps) {
  const { t } = useTranslation()
  const buttonClass =
    'grid size-9 place-items-center rounded-lg text-stone-600 transition hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div
      aria-label={`${t('common.quantity')}: ${label}`}
      className="inline-flex h-11 items-center rounded-xl border border-stone-200 bg-white p-1"
      dir="ltr"
      role="group"
    >
      <button
        aria-label={`${t('common.decrease')}: ${label}`}
        className={buttonClass}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        type="button"
      >
        <Icon className="size-4" name="minus" />
      </button>
      <output aria-live="polite" className="w-8 text-center text-sm font-extrabold text-stone-900">
        {value}
      </output>
      <button
        aria-label={`${t('common.increase')}: ${label}`}
        className={buttonClass}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        type="button"
      >
        <Icon className="size-4" name="plus" />
      </button>
    </div>
  )
}
