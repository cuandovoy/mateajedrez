/**
 * Barcode utilities for validation and formatting
 */

export type BarcodeType = 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'INTERNAL' | 'SUPPLIER' | 'OTHER'

export interface BarcodeTypeInfo {
  type: BarcodeType
  name: string
  description: string
  length: number | null // null means variable length
  pattern: RegExp
}

export const BARCODE_TYPES: Record<BarcodeType, BarcodeTypeInfo> = {
  EAN13: {
    type: 'EAN13',
    name: 'EAN-13',
    description: 'European Article Number (13 dígitos)',
    length: 13,
    pattern: /^[0-9]{13}$/,
  },
  EAN8: {
    type: 'EAN8',
    name: 'EAN-8',
    description: 'European Article Number (8 dígitos)',
    length: 8,
    pattern: /^[0-9]{8}$/,
  },
  UPC: {
    type: 'UPC',
    name: 'UPC',
    description: 'Universal Product Code (12 dígitos)',
    length: 12,
    pattern: /^[0-9]{12}$/,
  },
  CODE128: {
    type: 'CODE128',
    name: 'Code 128',
    description: 'Code 128 (longitud variable)',
    length: null,
    pattern: /^[A-Za-z0-9\s\-_]+$/,
  },
  CODE39: {
    type: 'CODE39',
    name: 'Code 39',
    description: 'Code 39 (longitud variable)',
    length: null,
    pattern: /^[A-Z0-9\s\-.$%/+]+$/,
  },
  INTERNAL: {
    type: 'INTERNAL',
    name: 'Código Interno',
    description: 'Código de barras interno personalizado',
    length: null,
    pattern: /^.+$/,
  },
  SUPPLIER: {
    type: 'SUPPLIER',
    name: 'Código Proveedor',
    description: 'Código de barras del proveedor',
    length: null,
    pattern: /^.+$/,
  },
  OTHER: {
    type: 'OTHER',
    name: 'Otro',
    description: 'Otro tipo de código de barras',
    length: null,
    pattern: /^.+$/,
  },
}

/**
 * Validates a barcode based on its type
 */
export function validateBarcode(barcode: string, type: BarcodeType): boolean {
  if (!barcode || barcode.trim() === '') {
    return false
  }

  const typeInfo = BARCODE_TYPES[type]
  if (!typeInfo) {
    return false
  }

  // Check pattern
  if (!typeInfo.pattern.test(barcode)) {
    return false
  }

  // Check length for fixed-length types
  if (typeInfo.length !== null && barcode.length !== typeInfo.length) {
    return false
  }

  return true
}

/**
 * Formats a barcode for display
 */
export function formatBarcode(barcode: string, type: BarcodeType): string {
  if (!barcode) return ''

  // For numeric barcodes, add spacing for readability
  if (type === 'EAN13' && barcode.length === 13) {
    return `${barcode.slice(0, 1)} ${barcode.slice(1, 7)} ${barcode.slice(7, 13)}`
  }

  if (type === 'UPC' && barcode.length === 12) {
    return `${barcode.slice(0, 1)} ${barcode.slice(1, 6)} ${barcode.slice(6, 11)} ${barcode.slice(11, 12)}`
  }

  return barcode
}

/**
 * Gets barcode type information
 */
export function getBarcodeTypeInfo(type: BarcodeType): BarcodeTypeInfo {
  return BARCODE_TYPES[type]
}

/**
 * Gets all available barcode types
 */
export function getBarcodeTypes(): BarcodeTypeInfo[] {
  return Object.values(BARCODE_TYPES)
}

/**
 * Calculates the check digit for an EAN13 barcode
 * @param baseCode - 12-digit base code (without check digit)
 * @returns The check digit (0-9)
 */
function calculateEAN13CheckDigit(baseCode: string): number {
  if (baseCode.length !== 12) {
    throw new Error('Base code must be exactly 12 digits')
  }

  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(baseCode[i], 10)
    // Odd positions (1-indexed) are multiplied by 1, even positions by 3
    // Since we're 0-indexed, even indices are odd positions
    if (i % 2 === 0) {
      sum += digit
    } else {
      sum += digit * 3
    }
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}

/**
 * Generates a valid EAN13 barcode automatically
 * Uses a base prefix (default: 779 for Argentina) + random/timestamp-based digits + check digit
 * @param prefix - 3-digit country/company prefix (default: 779 for Argentina)
 * @param existingBarcodes - Array of existing barcodes to avoid duplicates
 * @returns A valid 13-digit EAN13 barcode
 */
export function generateEAN13Barcode(
  prefix: string = '779',
  existingBarcodes: string[] = []
): string {
  if (prefix.length !== 3 || !/^\d{3}$/.test(prefix)) {
    throw new Error('Prefix must be exactly 3 digits')
  }

  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    // Generate 9 random digits (prefix 3 + random 9 = 12 digits base)
    const randomDigits = Math.floor(Math.random() * 1000000000)
      .toString()
      .padStart(9, '0')
    
    const baseCode = prefix + randomDigits

    // Calculate check digit
    const checkDigit = calculateEAN13CheckDigit(baseCode)
    const fullBarcode = baseCode + checkDigit.toString()

    // Check if it already exists
    if (!existingBarcodes.includes(fullBarcode)) {
      return fullBarcode
    }

    attempts++
  }

  // If we couldn't find a unique code, use timestamp-based approach
  const timestamp = Date.now().toString().slice(-9).padStart(9, '0')
  const baseCode = prefix + timestamp
  const checkDigit = calculateEAN13CheckDigit(baseCode)
  return baseCode + checkDigit.toString()
}

/**
 * Validates EAN13 check digit
 * @param barcode - 13-digit EAN13 barcode
 * @returns true if the check digit is valid
 */
export function validateEAN13CheckDigit(barcode: string): boolean {
  if (barcode.length !== 13 || !/^\d{13}$/.test(barcode)) {
    return false
  }

  const baseCode = barcode.slice(0, 12)
  const providedCheckDigit = parseInt(barcode[12], 10)
  const calculatedCheckDigit = calculateEAN13CheckDigit(baseCode)

  return providedCheckDigit === calculatedCheckDigit
}
