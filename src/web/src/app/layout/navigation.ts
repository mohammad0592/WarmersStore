export interface NavItem {
  to: string
  labelKey: 'nav.home' | 'nav.products' | 'nav.packages' | 'nav.distributors'
  /** Only active on an exact match (the home link). */
  end?: boolean
}

/**
 * Main navigation. The distributors link is controlled by the admin's "show distributors"
 * setting, so it stays hidden until real distributors exist.
 */
export function mainNavigation(showDistributors: boolean): NavItem[] {
  const items: NavItem[] = [
    { to: '/', labelKey: 'nav.home', end: true },
    { to: '/products', labelKey: 'nav.products' },
    { to: '/packages', labelKey: 'nav.packages' },
  ]
  if (showDistributors) {
    items.push({ to: '/distributors', labelKey: 'nav.distributors' })
  }
  return items
}
