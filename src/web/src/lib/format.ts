/** "49 ₪" for whole amounts, "12.50 ₪" otherwise. Matches the server's WhatsApp formatting. */
export function formatMoney(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} ₪`
}

/** wa.me chat link for an E.164 number ("+970…"), or null if there is no number. */
export function whatsAppChatUrl(number: string | null | undefined): string | null {
  const digits = number?.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

/** Arabic count of individual warmers: "قطعة واحدة", "قطعتان", "6 قطع", "12 قطعة". */
export function formatPieces(count: number): string {
  if (count === 1) return 'قطعة واحدة'
  if (count === 2) return 'قطعتان'
  if (count >= 3 && count <= 10) return `${count} قطع`
  return `${count} قطعة`
}

/** "8–10 ساعات", "4 ساعات", "12 ساعة"; null when no duration is known. */
export function formatHours(min: number | null, max: number | null): string | null {
  const low = min ?? max
  const high = max ?? min
  if (low === null || high === null) return null

  const range = low === high ? `${high}` : `${low}–${high}`
  const unit = high === 1 ? 'ساعة' : high === 2 ? 'ساعتان' : high >= 3 && high <= 10 ? 'ساعات' : 'ساعة'
  return `${range} ${unit}`
}

/** "10 × 13 سم" (width × height). */
export function formatDimensions(widthCm: number, heightCm: number): string {
  return `${widthCm} × ${heightCm} سم`
}
