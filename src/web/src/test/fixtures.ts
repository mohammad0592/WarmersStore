import type { City, CustomPackageRules, Distributor, Product, Quote, QuoteLine, ReadyMadePackage } from '@/lib/api/types'

export function rules(overrides: Partial<CustomPackageRules> = {}): CustomPackageRules {
  return {
    isEnabled: true,
    minItems: null,
    maxItems: null,
    minSubtotal: null,
    maxQuantityPerProduct: null,
    productRules: [],
    discountTiers: [],
    ...overrides,
  }
}

type RequestLine = { lineId: string; kind: 'ReadyMade' | 'Custom'; packageId?: number; quantity?: number; items?: { productId: number; quantity: number }[] }

/**
 * A stand-in for POST /api/checkout/quote: prices ready-made lines at `packagePrice` and custom
 * items at `itemPrice`. Enough to check the drawer shows server numbers, not its own.
 */
export function quoteFor(
  body: unknown,
  { packagePrice = 49, itemPrice = 6, lineErrors = {} }: { packagePrice?: number; itemPrice?: number; lineErrors?: Record<string, string> } = {},
): Quote {
  const requestLines = (body as { lines: RequestLine[] }).lines
  let customNumber = 0
  const lines: QuoteLine[] = requestLines.map((line) => {
    const errors = lineErrors[line.lineId] ? [{ code: 'package_not_found', message: lineErrors[line.lineId], params: null }] : []
    if (line.kind === 'ReadyMade') {
      const total = packagePrice * line.quantity!
      return {
        lineId: line.lineId, kind: 'ReadyMade', packageId: line.packageId!, name: 'باقة الأسبوع', quantity: line.quantity!,
        unitPrice: packagePrice, totalUnits: 7 * line.quantity!, subtotal: total, discount: 0, lineTotal: total,
        items: [{ productId: 1, productName: 'لاصق تدفئة الجسم', quantity: 5, sellingUnit: 'RetailBag', pieces: 5, unitPrice: null, subtotal: null }],
        errors,
      }
    }
    customNumber += 1
    const items = line.items!.map((i) => ({
      productId: i.productId, productName: `منتج ${i.productId}`, quantity: i.quantity, sellingUnit: 'RetailBag' as const,
      pieces: i.quantity, unitPrice: itemPrice, subtotal: itemPrice * i.quantity,
    }))
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
    return {
      lineId: line.lineId, kind: 'Custom', packageId: null, name: `باقة مخصّصة ${customNumber}`, quantity: 1, unitPrice: null,
      totalUnits: items.reduce((s, i) => s + i.quantity, 0), subtotal, discount: 0, lineTotal: subtotal, items, errors,
    }
  })
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  return {
    lines,
    subtotal,
    discountTotal: 0,
    delivery: { mode: 'None', areaId: null, areaName: null, fee: 0, isFree: false },
    total: subtotal,
    errors: [],
    isValid: lines.every((l) => l.errors.length === 0),
  }
}

export const nablus = { id: 1, slug: 'nablus', name: 'نابلس' }
export const hebron = { id: 3, slug: 'hebron', name: 'الخليل' }

export function city(base: { id: number; slug: string; name: string }, distributorCount: number): City {
  return { ...base, distributorCount }
}

export function distributor(overrides: Partial<Distributor> = {}): Distributor {
  return {
    id: 1,
    name: 'محل تجريبي',
    city: nablus,
    address: 'شارع تجريبي',
    phone: null,
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=32.2215,35.2544',
    imageUrl: null,
    ...overrides,
  }
}

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 2,
    slug: 'hand-warmer',
    name: 'دفاية اليدين',
    shortDescription: 'دفء صغير وسهل الحمل.',
    description: null,
    usageGuidance: null,
    safetyInfo: null,
    widthCm: 5.5,
    heightCm: 9,
    heatMinHours: 8,
    heatMaxHours: 10,
    isAdhesive: false,
    piecesPerRetailBag: 2,
    sellingUnit: 'RetailBag',
    piecesPerSellingUnit: 2,
    unitPrice: 5,
    availableForCustom: true,
    images: [],
    ...overrides,
  }
}

export function readyMadePackage(overrides: Partial<ReadyMadePackage> = {}): ReadyMadePackage {
  return {
    id: 10,
    slug: 'weekly',
    name: 'باقة الأسبوع',
    description: 'تشكيلة متوازنة للدوام.',
    imageUrl: null,
    price: 49,
    regularPrice: 50,
    isFeatured: true,
    isAvailable: true,
    items: [
      { productId: 1, productSlug: 'body-warmer', productName: 'لاصق تدفئة الجسم', quantity: 5, sellingUnit: 'RetailBag', piecesPerSellingUnit: 1, imageUrl: null },
      { productId: 2, productSlug: 'hand-warmer', productName: 'دفاية اليدين', quantity: 2, sellingUnit: 'RetailBag', piecesPerSellingUnit: 2, imageUrl: null },
    ],
    ...overrides,
  }
}
