import type { ReactNode, SVGProps } from 'react'

// Ported from the Figma Make export (design/figma-export/src/components/icons.tsx),
// plus "map-pin" and "phone" for the distributors directory.
export type IconName =
  | 'bag'
  | 'cart'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'flame'
  | 'heart'
  | 'info'
  | 'map-pin'
  | 'menu'
  | 'minus'
  | 'package'
  | 'phone'
  | 'plus'
  | 'shield'
  | 'spark'
  | 'trash'
  | 'truck'
  | 'whatsapp'

const paths: Record<IconName, ReactNode> = {
  bag: (
    <>
      <path d="M6 8h12l1 13H5L6 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2 11h10l2-8H6" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  flame: (
    <path d="M13 2c1 5-3 6-1 10 1-2 3-3 4-5 3 3 4 7 2 11a7 7 0 0 1-12-1c-2-5 2-8 5-12 0 3 1 4 2 5 1-3 0-5 0-8Z" />
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s-7-6.1-7-12a7 7 0 0 1 14 0c0 5.9-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <path d="M5 12h14" />,
  package: (
    <>
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </>
  ),
  phone: (
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  shield: (
    <>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  spark: (
    <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3ZM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15Z" />
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v11H3V6Zm11 4h4l3 3v4h-7v-7Z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z" />
      <path d="M9 8c.3 3 2 5 5 6l1-1" />
    </>
  ),
}

/** Decorative stroke icon; hidden from screen readers, so pair it with visible text or an aria-label. */
export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

/** Chevron pointing "forward" in right-to-left reading order (i.e. to the left). */
export function ForwardChevron({ className = 'size-4' }: { className?: string }) {
  return <Icon className={`${className} rotate-180`} name="chevron" />
}
