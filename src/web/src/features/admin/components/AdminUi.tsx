import { useCallback, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useDialog } from '@/lib/useDialog'

export const inputClass =
  'mt-1.5 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 aria-invalid:border-red-400 disabled:bg-stone-50'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-lg font-black">{title}</h2>}
      {children}
    </section>
  )
}

export function StatusBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

type FieldShellProps = { label: string; error?: string; hint?: string; required?: boolean; children: (id: string, describedBy?: string) => ReactNode }

/** Label + control + hint + error, wired for screen readers. */
export function Field({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p className="mt-1 text-xs text-stone-500" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs font-bold text-red-600" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

type Common = { label: string; error?: string; hint?: string; required?: boolean }

export function TextInput({ label, error, hint, required, className = '', ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field error={error} hint={hint} label={label} required={required}>
      {(id, describedBy) => (
        <input aria-describedby={describedBy} aria-invalid={!!error || undefined} className={`${inputClass} ${className}`} id={id} {...props} />
      )}
    </Field>
  )
}

export function TextArea({ label, error, hint, required, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field error={error} hint={hint} label={label} required={required}>
      {(id, describedBy) => (
        <textarea aria-describedby={describedBy} aria-invalid={!!error || undefined} className={`${inputClass} min-h-24 py-2`} id={id} {...props} />
      )}
    </Field>
  )
}

export function SelectInput({ label, error, hint, required, children, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field error={error} hint={hint} label={label} required={required}>
      {(id, describedBy) => (
        <select aria-describedby={describedBy} aria-invalid={!!error || undefined} className={inputClass} id={id} {...props}>
          {children}
        </select>
      )}
    </Field>
  )
}

export function Toggle({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input className="mt-1 size-5 accent-orange-600" id={id} type="checkbox" {...props} />
      <div>
        <label className="text-sm font-bold" htmlFor={id}>
          {label}
        </label>
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
    </div>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tones = { error: 'bg-red-50 text-red-700', success: 'bg-emerald-50 text-emerald-800', info: 'bg-amber-50 text-amber-900' }
  return (
    <div className={`rounded-xl p-3 text-sm font-bold ${tones[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

/** ↑/↓ buttons for display order. */
export function ReorderButtons({ label, isFirst, isLast, onMove, disabled }: { label: string; isFirst: boolean; isLast: boolean; onMove: (direction: -1 | 1) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const button = 'grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30'
  return (
    <div className="flex">
      <button aria-label={t('admin.common.moveUp', { name: label })} className={button} disabled={disabled || isFirst} onClick={() => onMove(-1)} type="button">
        <Icon className="size-4 -rotate-90" name="chevron" />
      </button>
      <button aria-label={t('admin.common.moveDown', { name: label })} className={button} disabled={disabled || isLast} onClick={() => onMove(1)} type="button">
        <Icon className="size-4 rotate-90" name="chevron" />
      </button>
    </div>
  )
}

/** Accessible confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const cancel = useCallback(() => onCancel(), [onCancel])
  useDialog(open, cancel, panel)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-stone-950/50 p-4">
      <div aria-labelledby="confirm-title" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" ref={panel} role="alertdialog">
        <h2 className="text-lg font-black" id="confirm-title">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-6 text-stone-600">{message}</div>
        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel} variant="ghost">
            {t('admin.common.cancel')}
          </Button>
          <Button className="bg-red-600 shadow-none hover:bg-red-700" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
