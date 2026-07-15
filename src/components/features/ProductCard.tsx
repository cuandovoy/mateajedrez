import { Link } from 'react-router-dom'
import { ShoppingCart, Package } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice, hasActiveDiscount, getEffectivePrice } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import type { Product, ProductImage } from '@/types'
import { useState, useEffect } from 'react'

interface ProductCardProps {
  product: Product & { product_images?: ProductImage[] }
  stock?: number
  hasVariants?: boolean
  noAddToCart?: boolean
  basePath?: string
}

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  if (url.trim() === '') return false
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

export function ProductCard({
  product,
  stock: stockProp,
  hasVariants = false,
  noAddToCart = false,
  basePath = '',
}: ProductCardProps) {
  const settings = useOrgSettings()
  const { addToCart } = useCartStore()
  const [isAdding, setIsAdding] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [stock, setStock] = useState<number | null>(null)

  const handleAddToCart = async () => {
    setIsAdding(true)
    try {
      await addToCart(product.id, 1)
    } catch (error) {
      console.error('Error adding to cart:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const imageUrls: string[] = []
  if (product.product_images && product.product_images.length > 0) {
    const sorted = [...product.product_images]
      .filter((img) => isValidImageUrl(img.image_url))
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return a.display_order - b.display_order
      })
    sorted.forEach((img) => {
      if (img.image_url && !imageUrls.includes(img.image_url)) {
        imageUrls.push(img.image_url)
      }
    })
  }
  if (product.image_url && isValidImageUrl(product.image_url) && !imageUrls.includes(product.image_url)) {
    imageUrls.push(product.image_url)
  }

  const currentImageUrl = imageUrls[currentImageIndex]

  useEffect(() => {
    if (typeof stockProp === 'number') {
      setStock(stockProp)
      return
    }
    let cancelled = false
    getProductStock(product.id, null, null, product.organization_id || null)
      .then((v) => { if (!cancelled) setStock(v) })
      .catch(() => { if (!cancelled) setStock(0) })
    return () => { cancelled = true }
  }, [product.id, product.organization_id, stockProp])

  const hasStock = stock !== null ? stock > 0 : false
  const productUrl = `${basePath}/product/${product.id}`
  const showAddButton = !noAddToCart && !hasVariants && stock !== null && hasStock

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 flex flex-col h-full">
      {/* Image area */}
      <div className="relative overflow-hidden">
        <Link to={productUrl}>
          <div className="aspect-square bg-gray-50">
            {currentImageUrl ? (
              <img
                key={currentImageIndex}
                src={currentImageUrl}
                alt={capitalizeFirst(product.name)}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => {
                  if (currentImageIndex < imageUrls.length - 1) {
                    setCurrentImageIndex(currentImageIndex + 1)
                  } else {
                    setCurrentImageIndex(-1)
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                <Package className="h-14 w-14" />
              </div>
            )}
          </div>
        </Link>

        {/* Discount badge */}
        {hasActiveDiscount(product) && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm z-10">
            -{product.discount_percentage}%
          </span>
        )}

        {/* Out of stock overlay */}
        {stock !== null && !hasStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800/90 text-white text-xs font-medium px-3 py-1.5 rounded-full tracking-wide">
              Sin stock
            </span>
          </div>
        )}

        {/* Add to cart button — always visible on mobile, hover-only on desktop */}
        {showAddButton && (
          <button
            onClick={handleAddToCart}
            disabled={isAdding}
            className="absolute bottom-3 right-3 rounded-full p-2.5 md:p-3 shadow-lg z-10 md:opacity-0 md:group-hover:opacity-100 md:translate-y-2 md:group-hover:translate-y-0 transition-all duration-300 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--org-primary-color, #6366f1)',
              color: 'var(--org-primary-ink, white)',
            }}
            aria-label="Agregar al carrito"
          >
            {isAdding ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-grow">
        <Link to={productUrl}>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-3 hover:opacity-70 transition-opacity">
            {capitalizeFirst(product.name)}
          </h3>
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            {hasActiveDiscount(product) && (
              <span className="text-xs text-gray-400 line-through block">
                {formatPrice(product.price, settings)}
              </span>
            )}
            <span
              className="text-base font-bold leading-none"
              style={{ color: 'var(--org-primary-color, #6366f1)' }}
            >
              {formatPrice(getEffectivePrice(product), settings)}
            </span>
          </div>

          {stock !== null && hasStock && (
            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-600">
              En stock
            </span>
          )}
        </div>

        {!noAddToCart && hasVariants && (
          <Link to={productUrl} className="mt-3">
            <Button variant="outline" size="sm" className="w-full text-xs rounded-xl" disabled={!hasStock}>
              {hasStock ? 'Ver opciones' : 'Sin stock'}
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
