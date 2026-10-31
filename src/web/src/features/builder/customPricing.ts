import type { CustomPackageRules, Product } from '@/lib/api/types'

/** Money rounding to the agora, half away from zero for positive amounts (as on the server). */
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export type BuilderIssue =
  | { code: 'empty'; min: number | null }
  | { code: 'needMore'; count: number }
  | { code: 'tooMany'; max: number }
  | { code: 'needAmount'; amount: number }
  | { code: 'productMin'; name: string; min: number }
  | { code: 'productMax'; name: string; max: number }

export interface BuilderLine {
  product: Product
  quantity: number
  subtotal: number
}

export interface BuilderEvaluation {
  lines: BuilderLine[]
  units: number
  pieces: number
  subtotal: number
  discount: number
  total: number
  /** The first issue is the one shown; empty means the package can go in the cart. */
  issues: BuilderIssue[]
  isValid: boolean
}

/** Effective per-product cap: the stricter of the store-wide and product-specific limits. */
export function maxQuantityFor(productId: number, rules: CustomPackageRules): number | null {
  const productMax = rules.productRules.find((r) => r.productId === productId)?.maxQty ?? null
  const globalMax = rules.maxQuantityPerProduct
  if (productMax !== null && globalMax !== null) return Math.min(productMax, globalMax)
  return productMax ?? globalMax
}

/** Highest reached tier applies; percentages round to the agora; never more than the subtotal. */
export function discountFor(subtotal: number, units: number, rules: CustomPackageRules): number {
  let best: number | null = null
  let bestMin = -1
  for (const tier of rules.discountTiers) {
    if (tier.minItems > units) continue
    const amount = Math.min(subtotal, tier.type === 'Percent' ? roundMoney((subtotal * tier.value) / 100) : tier.value)
    if (tier.minItems > bestMin || (tier.minItems === bestMin && amount > (best ?? 0))) {
      best = amount
      bestMin = tier.minItems
    }
  }
  return best ?? 0
}

/**
 * Live estimate for the builder, mirroring the server's rules (PricingEngine) so customers see
 * problems before adding to the cart. The server still re-prices and re-checks everything.
 */
export function evaluateCustomPackage(
  selection: Record<number, number>,
  products: Product[],
  rules: CustomPackageRules,
): BuilderEvaluation {
  const lines: BuilderLine[] = products
    .filter((p) => p.availableForCustom && p.unitPrice !== null && (selection[p.id] ?? 0) > 0)
    .map((p) => ({ product: p, quantity: selection[p.id], subtotal: roundMoney(p.unitPrice! * selection[p.id]) }))

  const units = lines.reduce((sum, l) => sum + l.quantity, 0)
  const pieces = lines.reduce((sum, l) => sum + l.quantity * l.product.piecesPerSellingUnit, 0)
  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.subtotal, 0))
  const discount = discountFor(subtotal, units, rules)

  const issues: BuilderIssue[] = []
  if (units === 0) {
    issues.push({ code: 'empty', min: rules.minItems })
  } else {
    for (const line of lines) {
      const productMin = rules.productRules.find((r) => r.productId === line.product.id)?.minQty ?? null
      const max = maxQuantityFor(line.product.id, rules)
      if (productMin !== null && line.quantity < productMin) issues.push({ code: 'productMin', name: line.product.name, min: productMin })
      if (max !== null && line.quantity > max) issues.push({ code: 'productMax', name: line.product.name, max })
    }
    if (rules.minItems !== null && units < rules.minItems) issues.push({ code: 'needMore', count: rules.minItems - units })
    if (rules.maxItems !== null && units > rules.maxItems) issues.push({ code: 'tooMany', max: rules.maxItems })
    if (rules.minSubtotal !== null && subtotal < rules.minSubtotal) {
      issues.push({ code: 'needAmount', amount: roundMoney(rules.minSubtotal - subtotal) })
    }
  }

  return {
    lines,
    units,
    pieces,
    subtotal,
    discount,
    total: roundMoney(subtotal - discount),
    issues,
    isValid: issues.length === 0,
  }
}
