import { type ClassValue, clsx } from 'clsx'
import type { Product, ProductImage } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(price)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Validates if an image URL is valid and accessible
 */
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  
  // Check if it's a non-empty string
  if (url.trim() === '') return false
  
  try {
    const urlObj = new URL(url)
    // Check if it's a valid HTTP/HTTPS URL
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Gets the primary image URL for a product
 * Checks product_images table first, then falls back to image_url
 * Validates URLs before returning them
 */
export function getProductImageUrl(
  product: Product & { product_images?: ProductImage[] },
  variantImageUrl?: string | null
): string | null {
  // Variant image takes priority
  if (variantImageUrl && isValidImageUrl(variantImageUrl)) {
    return variantImageUrl
  }

  // Check product_images table
  if (product.product_images && product.product_images.length > 0) {
    // Try to find primary image
    const primary = product.product_images.find((img) => img.is_primary && isValidImageUrl(img.image_url))
    if (primary) return primary.image_url
    
    // If no valid primary, return first valid image sorted by display_order
    const sorted = product.product_images
      .filter((img) => isValidImageUrl(img.image_url))
      .sort((a, b) => a.display_order - b.display_order)
    
    if (sorted.length > 0) return sorted[0].image_url
  }

  // Fallback to legacy image_url (only if valid)
  if (isValidImageUrl(product.image_url)) {
    return product.image_url || null
  }

  return null
}
