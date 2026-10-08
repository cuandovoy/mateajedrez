/** Physical store address — single source of truth for the text, map and directions. */
export const STORE_ADDRESS = 'Avenida España 1471, Paysandú, Uruguay'

/** Keyless Google Maps embed URL for an address. Empty string when the address is blank. */
export function buildMapEmbedUrl(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return ''
  return `https://www.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`
}

/** Google Maps "directions to" URL for an address. Empty string when the address is blank. */
export function buildDirectionsUrl(address: string): string {
  const trimmed = address.trim()
  if (!trimmed) return ''
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`
}

/** wa.me link from a raw phone number; null when there are no digits to dial. */
export function buildWhatsappUrl(rawNumber: string | null | undefined): string | null {
  const digits = (rawNumber ?? '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}
