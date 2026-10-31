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
