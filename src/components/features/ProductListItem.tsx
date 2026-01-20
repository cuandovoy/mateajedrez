import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@/types'
import { useState } from 'react'

interface ProductListItemProps {
  product: Product
  noAddToCart?: boolean
}

export function ProductListItem({ product, noAddToCart = false }: ProductListItemProps) {
  const { addToCart } = useCartStore()
  const [isAdding, setIsAdding] = useState(false)

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

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col md:flex-row">
        <Link to={`/products/${product.id}`} className="md:w-64 flex-shrink-0">
          <div className="w-full h-48 md:h-full bg-gray-200">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Sin imagen
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex-1 mb-4 md:mb-0 md:mr-6">
            <Link to={`/products/${product.id}`}>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-primary-200 transition-colors">
                {product.name}
              </h3>
            </Link>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {product.description || 'Sin descripción'}
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-2xl font-bold text-primary-200">
                {formatPrice(product.price)}
              </span>
              {product.stock > 0 ? (
                <span className="text-sm text-green-600 font-medium">En stock</span>
              ) : (
                <span className="text-sm text-red-600 font-medium">Sin stock</span>
              )}
            </div>
          </div>
          <div className="md:w-48 flex-shrink-0">
            {!noAddToCart && <Button
              className="w-full"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || isAdding}
              isLoading={isAdding}
            >
              {!noAddToCart && <ShoppingCart className="h-4 w-4 mr-2" />}
              Agregar al carrito
            </Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
