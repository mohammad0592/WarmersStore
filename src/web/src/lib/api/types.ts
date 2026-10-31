// Mirrors the public DTOs of the ASP.NET Core API (src/WarmersStore.Api/Features/*).

export type SellingUnit = 'Piece' | 'RetailBag'

export interface ProductImage {
  url: string
  alt: string | null
}

export interface Product {
  id: number
  slug: string
  name: string
  shortDescription: string | null
  description: string | null
  usageGuidance: string | null
  /** Null until the business supplies real safety guidance; never filled with invented text. */
  safetyInfo: string | null
  widthCm: number
  heightCm: number
  heatMinHours: number | null
  heatMaxHours: number | null
  /** Null when the adhesive status hasn't been specified. */
  isAdhesive: boolean | null
  piecesPerRetailBag: number
  sellingUnit: SellingUnit
  piecesPerSellingUnit: number
  unitPrice: number | null
  availableForCustom: boolean
  images: ProductImage[]
}

export interface PackageItem {
  productId: number
  productSlug: string
  productName: string
  quantity: number
  sellingUnit: SellingUnit
  piecesPerSellingUnit: number
  imageUrl: string | null
}

export interface ReadyMadePackage {
  id: number
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  /** What the contents cost bought individually; null if any content is unpriced. */
  regularPrice: number | null
  isFeatured: boolean
  /** False while any product in the package is inactive. */
  isAvailable: boolean
  items: PackageItem[]
}

// ---- Custom package rules (null = not configured) ----

export interface CustomPackageRules {
  isEnabled: boolean
  minItems: number | null
  maxItems: number | null
  minSubtotal: number | null
  maxQuantityPerProduct: number | null
  productRules: { productId: number; minQty: number | null; maxQty: number | null }[]
  discountTiers: { minItems: number; type: 'Percent' | 'Fixed'; value: number }[]
}

// ---- Checkout quote: the server's pricing of the cart ----

export type CartLineKind = 'ReadyMade' | 'Custom'
export type DeliveryMode = 'None' | 'Flat' | 'PerArea'

/** A business-rule problem; `message` is display-ready Arabic, `code` is stable. */
export interface CheckoutError {
  code: string
  message: string
  params: Record<string, unknown> | null
}

export interface QuoteItem {
  productId: number
  productName: string | null
  quantity: number
  sellingUnit: SellingUnit | null
  pieces: number
  unitPrice: number | null
  subtotal: number | null
}

export interface QuoteLine {
  lineId: string
  kind: CartLineKind
  packageId: number | null
  name: string | null
  quantity: number
  unitPrice: number | null
  totalUnits: number
  subtotal: number
  discount: number
  lineTotal: number
  items: QuoteItem[]
  errors: CheckoutError[]
}

export interface Quote {
  lines: QuoteLine[]
  /** After custom-package discounts, before delivery. */
  subtotal: number
  discountTotal: number
  delivery: { mode: DeliveryMode; areaId: number | null; areaName: string | null; fee: number | null; isFree: boolean }
  total: number
  errors: CheckoutError[]
  isValid: boolean
}

/** Delivery for online orders; areas are only listed in PerArea mode. */
export interface DeliveryOptions {
  mode: DeliveryMode
  flatFee: number | null
  freeDeliveryThreshold: number | null
  message: string | null
  areas: { id: number; name: string; fee: number; freeDeliveryThreshold: number | null; note: string | null }[]
}

export interface SubmitResult {
  reference: string
  quote: Quote
  message: string
  whatsAppUrl: string
}

/** A city a customer can pick on /distributors: active, with at least one active distributor. */
export interface City {
  id: number
  slug: string
  name: string
  distributorCount: number
}

/** An authorized physical shop. Purchases happen in the shop only; there is no delivery. */
export interface Distributor {
  id: number
  name: string
  city: { id: number; slug: string; name: string }
  address: string
  phone: string | null
  /** Google Maps link built by the server (from coordinates or the admin's validated URL). */
  mapUrl: string | null
  imageUrl: string | null
}

export interface SocialLinks {
  facebook: string | null
  instagram: string | null
  tikTok: string | null
}

export interface PublicStoreSettings {
  storeName: string
  logoUrl: string | null
  /** E.164, e.g. "+970599123456". Null until the admin sets it; ordering is unavailable meanwhile. */
  whatsAppNumber: string | null
  phone: string | null
  email: string | null
  address: string | null
  social: SocialLinks
  /** Only present while the admin has the announcement switched on. */
  announcement: string | null
  minOrderTotal: number | null
  showDistributors: boolean
  /** Admin-edited homepage text; each null falls back to the built-in Arabic text. */
  homepage: HomepageText
}

export interface HomepageText {
  heroTitle: string | null
  heroDescription: string | null
  whereToFindText: string | null
}
