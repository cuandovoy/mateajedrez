/**
 * Validators for Uruguayan formats (RUT and phone numbers)
 */

/**
 * Validates Uruguayan RUT (Registro Único Tributario)
 * Format: XX XXXXXX 001 X (12 digits total)
 * - 2 digits: category
 * - 6 digits: sequential number
 * - "001" fixed
 * - 1 digit: check digit
 * 
 * @param rut - RUT string (can include spaces, dots, or dashes)
 * @returns true if valid format
 */
export function validateUruguayanRUT(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false

  // Remove spaces, dots, and dashes
  const cleanRUT = rut.replace(/[\s.\-]/g, '')

  // Must be exactly 12 digits
  if (!/^\d{12}$/.test(cleanRUT)) return false

  // Check that positions 9-11 are "001"
//   if (cleanRUT.slice(8, 11) !== '001') return false

  // Basic format validation passed
  // Note: Full validation would require calculating the check digit,
  // but for now we'll accept any valid format
  return true
}

/**
 * Formats Uruguayan RUT for display
 * Format: XX.XXXXXX.001-X
 * 
 * @param rut - RUT string
 * @returns Formatted RUT string
 */
export function formatUruguayanRUT(rut: string): string {
  if (!rut) return ''

  const cleanRUT = rut.replace(/[\s.\-]/g, '')

  if (cleanRUT.length !== 12) return rut

  // Format: XX.XXXXXX.001-X
  return `${cleanRUT.slice(0, 2)}.${cleanRUT.slice(2, 8)}.${cleanRUT.slice(8, 11)}-${cleanRUT.slice(11)}`
}

/**
 * Validates Uruguayan phone number
 * Format: 8 digits
 * - Mobile: starts with 9
 * - Montevideo fixed: starts with 2
 * - Other regions fixed: starts with 4-7
 * Can include +598 prefix or not
 * 
 * @param phone - Phone string (can include +598, spaces, dashes, parentheses)
 * @returns true if valid format
 */
export function validateUruguayanPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false

  // Remove spaces, dashes, parentheses, and +598 prefix
  let cleanPhone = phone.replace(/[\s\-()]/g, '')
  
  // Remove +598 prefix if present
  if (cleanPhone.startsWith('+598')) {
    cleanPhone = cleanPhone.slice(4)
  } else if (cleanPhone.startsWith('00598')) {
    cleanPhone = cleanPhone.slice(5)
  } else if (cleanPhone.startsWith('598')) {
    cleanPhone = cleanPhone.slice(3)
  }

  // Must be exactly 8 digits
  if (!/^\d{8}$/.test(cleanPhone)) return false

  // Must start with valid prefix
  const firstDigit = cleanPhone[0]
  return firstDigit === '9' || firstDigit === '2' || ['4', '5', '6', '7'].includes(firstDigit)
}

/**
 * Formats Uruguayan phone number for display
 * Format: +598 X XXX XXXX or 0X XXXX XXXX
 * 
 * @param phone - Phone string
 * @returns Formatted phone string
 */
export function formatUruguayanPhone(phone: string): string {
  if (!phone) return ''

  // Remove spaces, dashes, parentheses
  let cleanPhone = phone.replace(/[\s\-()]/g, '')
  
  // Remove +598 prefix if present
  if (cleanPhone.startsWith('+598')) {
    cleanPhone = cleanPhone.slice(4)
  } else if (cleanPhone.startsWith('00598')) {
    cleanPhone = cleanPhone.slice(5)
  } else if (cleanPhone.startsWith('598')) {
    cleanPhone = cleanPhone.slice(3)
  }

  if (cleanPhone.length !== 8) return phone

  // Format: +598 X XXX XXXX
  return `+598 ${cleanPhone.slice(0, 1)} ${cleanPhone.slice(1, 4)} ${cleanPhone.slice(4)}`
}

/**
 * Normalizes phone number to store in database (without formatting)
 * Removes all formatting and keeps only digits
 * 
 * @param phone - Phone string
 * @returns Normalized phone string (8 digits or +598 + 8 digits)
 */
export function normalizeUruguayanPhone(phone: string): string {
  if (!phone) return ''

  // Remove spaces, dashes, parentheses
  let cleanPhone = phone.replace(/[\s\-()]/g, '')
  
  // If it starts with +598, keep it
  if (cleanPhone.startsWith('+598')) {
    return cleanPhone
  } else if (cleanPhone.startsWith('00598')) {
    return `+598${cleanPhone.slice(5)}`
  } else if (cleanPhone.startsWith('598')) {
    return `+598${cleanPhone.slice(3)}`
  }

  // If it's just 8 digits, add +598
  if (/^\d{8}$/.test(cleanPhone)) {
    return `+598${cleanPhone}`
  }

  return cleanPhone
}
