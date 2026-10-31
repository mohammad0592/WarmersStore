export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'whatsapp' | 'light'

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-orange-600 text-white shadow-[0_8px_24px_rgba(234,88,12,.2)] hover:bg-orange-700',
  secondary: 'border border-orange-200 bg-white text-orange-800 hover:bg-orange-50',
  ghost: 'text-stone-700 hover:bg-stone-100',
  whatsapp: 'bg-emerald-600 text-white shadow-[0_8px_24px_rgba(5,150,105,.2)] hover:bg-emerald-700',
  light: 'bg-white font-extrabold text-orange-700 hover:bg-orange-50',
}

/** Button styles from the design, shared by buttons, router links and external links. */
export function buttonClasses(variant: ButtonVariant = 'primary', className = '') {
  return `${base} ${variants[variant]} ${className}`
}
