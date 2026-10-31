import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/** Centered eyebrow chip, heading and intro used at the top of each home/page section. */
export function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: ReactNode }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <span className="mb-3 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold text-orange-800">
        {eyebrow}
      </span>
      <h2 className="text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 leading-7 text-stone-600">{text}</p>}
    </div>
  )
}

/** Dark banner at the top of inner pages. */
export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-stone-950 px-4 py-16 text-white sm:py-20">
      <div aria-hidden="true" className="absolute -left-20 -top-20 size-64 rounded-full bg-orange-600/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl text-center">
        <span className="text-xs font-extrabold text-orange-300">{eyebrow}</span>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-stone-300">{text}</p>
      </div>
    </section>
  )
}

export function EmptyState({ text, icon = 'package', children }: { text: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
      <Icon className="mx-auto size-12 text-stone-300" name={icon} />
      <p className="mt-4 font-bold text-stone-600">{text}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}

/** Image with the design's warm placeholder (an icon on light orange) when there is no photo yet. */
export function MediaImage({
  src,
  alt,
  className = '',
  fallbackIcon = 'flame',
}: {
  src: string | null | undefined
  alt: string
  className?: string
  fallbackIcon?: IconName
}) {
  return (
    <div className={`relative overflow-hidden bg-orange-50 ${className}`}>
      {src ? (
        <img
          alt={alt}
          className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
          decoding="async"
          loading="lazy"
          src={src}
        />
      ) : (
        <div className="grid h-full place-items-center text-orange-300">
          <Icon className="size-14" name={fallbackIcon} />
        </div>
      )}
    </div>
  )
}
