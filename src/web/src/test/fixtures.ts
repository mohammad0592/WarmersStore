import type { City, Distributor, Product, ReadyMadePackage } from '@/lib/api/types'

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
