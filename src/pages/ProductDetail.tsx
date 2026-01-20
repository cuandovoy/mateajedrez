import { ProductCard } from '@/components/features/ProductCard'
import { VariantSelector } from '@/components/features/VariantSelector'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cartStore'
import type { Product, ProductWithCategory } from '@/types'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { addToCart } = useCartStore()
  const [product, setProduct] = useState<ProductWithCategory | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)

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
        .eq('id', id as string)
        .eq('is_active', true)
        .single()

      if (error) throw error

      setProduct(data as ProductWithCategory)

      // Fetch related products
      if ((data as ProductWithCategory)?.category_id) {
        const { data: related, error: relatedError } = await supabase
          .from('products')
          .select('*')
          .eq('category_id', (data as ProductWithCategory).category_id)
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
      await addToCart(product.id, quantity, selectedVariantId || undefined)
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
          {(selectedVariant?.image_url || product.image_url) ? (
            <img
              src={selectedVariant?.image_url || product.image_url || ''}
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
              {formatPrice(selectedVariant?.price ?? product.price)}
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
          </div>

          {/* Variant Selector - Solo permite seleccionar una variante a la vez */}
          <div className="mb-6">
            <VariantSelector
              product={product}
              selectedVariantId={selectedVariantId}
              onVariantChange={(variantId) => {
                setSelectedVariantId(variantId)
                // Fetch variant details to get stock, price, and image
                if (variantId) {
                  supabase
                    .from('product_variants')
                    .select('*')
                    .eq('id', variantId)
                    .single()
                    .then(({ data }) => {
                      if (data) {
                        setSelectedVariant(data)
                        // Reset quantity to 1 when variant changes
                        setQuantity(1)
                      }
                    })
                } else {
                  setSelectedVariant(null)
                  // Reset quantity to 1 when variant is cleared
                  setQuantity(1)
                }
              }}
            />
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
                    onClick={() => {
                      const maxStock = selectedVariant?.stock ?? product.stock
                      setQuantity(Math.min(maxStock, quantity + 1))
                    }}
                    disabled={quantity >= (selectedVariant?.stock ?? product.stock)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Stock disponible: <span className="font-semibold">{selectedVariant?.stock ?? product.stock} {selectedVariant?.unit || product.unit || 'unidad'}</span>
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleAddToCart}
                disabled={(selectedVariant?.stock ?? product.stock) === 0 || isAdding}
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
