import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatPrice } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import type { Product, ProductImage } from '@/types'
import { useState, useEffect } from 'react'

interface ProductCardProps {
  product: Product & { product_images?: ProductImage[] }
  noAddToCart?: boolean
  basePath?: string
}

// Helper function to validate image URLs
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

export function ProductCard({ product, noAddToCart = false, basePath = '' }: ProductCardProps) {
  const settings = useOrgSettings()
  const { addToCart } = useCartStore()
  const [isAdding, setIsAdding] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [stock, setStock] = useState<number | null>(null) // null = loading, number = loaded

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

  // Get all available image URLs in priority order
  const imageUrls: string[] = []
  
  // 1. Product images (sorted by is_primary and display_order)
  if (product.product_images && product.product_images.length > 0) {
    const sorted = [...product.product_images]
      .filter((img) => isValidImageUrl(img.image_url))
      .sort((a, b) => {
        // Primary images first
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        // Then by display_order
        return a.display_order - b.display_order
      })
    
    sorted.forEach((img) => {
      if (img.image_url && !imageUrls.includes(img.image_url)) {
        imageUrls.push(img.image_url)
      }
    })
  }
  
  // 2. Legacy image_url (if exists and valid)
  if (product.image_url && isValidImageUrl(product.image_url) && !imageUrls.includes(product.image_url)) {
    imageUrls.push(product.image_url)
  }

  const currentImageUrl = imageUrls[currentImageIndex]

  // Fetch stock from branch_inventory
  useEffect(() => {
    let cancelled = false
    getProductStock(product.id)
      .then((stockValue) => {
        if (!cancelled) {
          setStock(stockValue)
        }
      })
      .catch((error) => {
        console.error('Error fetching stock for product:', product.id, error)
        if (!cancelled) {
          setStock(0) // Default to 0 on error
        }
      })

    return () => {
      cancelled = true
    }
  }, [product.id])

  const hasStock = stock !== null ? stock > 0 : false

  return (
    <div 
      className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full group"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--org-primary-color, #6366f1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = ''
      }}
    >
      <Link to={`${basePath}/product/${product.id}`} className="block overflow-hidden">
        <div className="w-full bg-gray-200 relative" style={{ aspectRatio: '16/9', minHeight: '192px' }}>
          {currentImageUrl ? (
            <img
              key={currentImageIndex}
              src={currentImageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              style={{ aspectRatio: '16/9' }}
              onError={() => {
                console.error('Error loading product image:', currentImageUrl)
                // Try next image if available
                if (currentImageIndex < imageUrls.length - 1) {
                  setCurrentImageIndex(currentImageIndex + 1)
                } else {
                  setCurrentImageIndex(-1)
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400" style={{ aspectRatio: '16/9' }}>
              Sin imagen
            </div>
          )}
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-grow">
        <Link to={`${basePath}/product/${product.id}`} className="group/link">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover/link:text-primary-600 transition-colors duration-300">
            {product.name}
          </h3>
        </Link>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2 flex-grow">
          {product.description || 'Sin descripción'}
        </p>
        <div className="flex items-center justify-between mb-4">
          <span 
            className="text-2xl font-bold transition-colors"
            style={{ 
              color: 'var(--org-primary-color, #6366f1)',
            }}
          >
            {formatPrice(product.price, settings)}
          </span>
          <div className="flex items-center space-x-2">
            {stock === null ? (
              <span className="text-sm text-gray-400 font-medium">Cargando...</span>
            ) : hasStock ? (
              <span className="text-sm text-green-600 font-medium">En stock</span>
            ) : (
              <span className="text-sm text-red-600 font-medium">Sin stock</span>
            )}
          </div>
        </div>
        {!noAddToCart && (
          <Button
            variant="primary"
            className="w-full mt-auto hover:shadow-md transition-all duration-300 font-semibold"
            onClick={handleAddToCart}
            disabled={!hasStock || isAdding}
            isLoading={isAdding}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Agregar al carrito
          </Button>
        )}
      </div>
    </div>
  )
}
