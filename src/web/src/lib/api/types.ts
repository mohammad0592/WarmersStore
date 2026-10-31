// Mirrors the public DTOs of the ASP.NET Core API (src/WarmersStore.Api/Features/*).

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
