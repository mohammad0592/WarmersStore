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
}
