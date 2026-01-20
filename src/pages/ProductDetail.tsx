import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ShoppingCart, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ProductCard } from '@/components/features/ProductCard'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import type { Product, ProductWithCategory } from '@/types'

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const { addToCart } = useCartStore()
  const [product, setProduct] = useState<ProductWithCategory | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (id) {
      fetchProduct()
    }
  }, [id])

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (error) throw error

      setProduct(data as ProductWithCategory)

      // Fetch related products
      if (data?.category_id) {
        const { data: related, error: relatedError } = await supabase
          .from('products')
          .select('*')
          .eq('category_id', data.category_id)
          .eq('is_active', true)
          .neq('id', id)
          .limit(4)

        if (!relatedError && related) {
          setRelatedProducts(related)
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return

    setIsAdding(true)
    try {
      await addToCart(product.id, quantity)
    } catch (error) {
      console.error('Error adding to cart:', error)
    } finally {
      setIsAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container-custom py-8 text-center">
        <p className="text-gray-600 text-lg mb-4">Producto no encontrado</p>
        <Link to="/products">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a productos
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container-custom py-8">
      <Link to="/products">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a productos
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Imagen del producto */}
        <div>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-auto rounded-lg shadow-lg object-cover"
            />
          ) : (
            <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
              Sin imagen
            </div>
          )}
        </div>

        {/* Información del producto */}
        <div>
          <div className="mb-4">
            {product.category && (
              <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-2">
                {product.category.name}
              </span>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <p className="text-2xl font-bold text-primary-200 mb-4">
              {formatPrice(product.price)}
            </p>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 leading-relaxed">
              {product.description || 'Sin descripción disponible'}
            </p>
          </div>

          <div className="mb-6 space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-700">SKU: </span>
              <span className="text-sm text-gray-600">{product.sku}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Stock: </span>
              {product.stock > 0 ? (
                <span className="text-sm text-green-600 font-medium">
                  {product.stock} unidades disponibles
                </span>
              ) : (
                <span className="text-sm text-red-600 font-medium">Sin stock</span>
              )}
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <label className="text-sm font-medium text-gray-700">Cantidad:</label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                  >
                    +
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleAddToCart}
                disabled={product.stock === 0 || isAdding}
                isLoading={isAdding}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Agregar al carrito
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Productos relacionados */}
      {relatedProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Productos relacionados
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
