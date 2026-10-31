import type { ReadyMadePackage } from '@/lib/api/types'

/** Savings versus buying the contents one by one, when that is known and positive. */
export function packageSavings(item: ReadyMadePackage): number | null {
  if (item.regularPrice === null) return null
  const savings = Math.round((item.regularPrice - item.price) * 100) / 100
  return savings > 0 ? savings : null
}
