export const COUNTRY_CODES = ['+970', '+972', 'other'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

const E164 = /^\+[1-9]\d{7,14}$/

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII, so numbers typed on Arabic keyboards work. */
function asciiDigits(value: string) {
  return value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

/**
 * Combines the chosen country code with what the customer typed, the way people actually type
 * Palestinian numbers: "0599 123 456" with +970 becomes "+970599123456". A full international
 * number ("+44…" or "0044…") is accepted as-is with any code. Returns E.164 or null.
 */
export function composePhone(code: CountryCode, input: string): string | null {
  const cleaned = asciiDigits(input.trim()).replace(/[\s\-().‎‏]/g, '')
  if (!/^\+?\d+$/.test(cleaned)) return null

  let number: string
  if (cleaned.startsWith('+')) number = cleaned
  else if (cleaned.startsWith('00')) number = `+${cleaned.slice(2)}`
  else if (code === 'other') return null
  else number = code + cleaned.replace(/^0/, '')

  return E164.test(number) ? number : null
}
