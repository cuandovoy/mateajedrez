import { ProductCard } from '@/components/features/ProductCard'
import { VariantSelector } from '@/components/features/VariantSelector'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { capitalizeFirst, formatPrice } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import { useCartStore } from '@/store/cartStore'
import type { Product, ProductWithCategory, ProductImage } from '@/types'
import { ArrowLeft, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'

const DEFAULT_PRODUCT_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="%23f3f4f6"/><g fill="%239ca3af"><rect x="240" y="260" width="320" height="220" rx="24"/><circle cx="320" cy="330" r="28"/><path d="M270 450l95-95 62 62 48-48 55 81z"/></g><text x="50%25" y="560" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" fill="%236b7280">Sin imagen</text></svg>'

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

export function ProductDetail() {
  const { slug, id } = useParams<{ slug?: string; id: string }>()
  const settings = useOrgSettings()
  const { addToCart } = useCartStore()
  const [product, setProduct] = useState<ProductWithCategory | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<{ image_url?: string | null; price?: number | null; stock?: number; unit?: string | null } | null>(null)
  const [hasActiveVariants, setHasActiveVariants] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoading, setImageLoading] = useState(true)
  const [fadeIn, setFadeIn] = useState(false)
  const [allImagesFailed, setAllImagesFailed] = useState(false)
  const [productStock, setProductStock] = useState<number | null>(null)
  const [variantStock, setVariantStock] = useState<number | null>(null)
  const productRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    if (id) {
      fetchProduct()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Scroll to product when page loads
  useEffect(() => {
    if (!loading && product && productRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        productRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loading, product])

  const fetchProduct = async () => {
    if (!id) return
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          product_images (
            id,
            image_url,
            display_order,
            is_primary
          )
        `)
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (error) throw error

      setProduct(data as ProductWithCategory & { product_images?: ProductImage[] })
      setCurrentImageIndex(0) // Reset image index when product changes
      setImageLoading(true)
      setFadeIn(false)
      setAllImagesFailed(false)

      // Determine if product has active variants (to enforce selection flow)
      const { count: activeVariantsCount } = await supabase
        .from('product_variants')
        .select('id', { head: true, count: 'exact' })
        .eq('product_id', id)
        .eq('is_active', true)

      setHasActiveVariants((activeVariantsCount || 0) > 0)
      
      // Fetch product stock from branch_inventory
      if (data) {
        const productData = data as ProductWithCategory & { product_images?: ProductImage[] }
        getProductStock(productData.id as string)
          .then((stock) => setProductStock(stock))
          .catch((error) => {
            console.error('Error fetching product stock:', error)
            setProductStock(0)
          })
      }

      // Fetch related products
      if ((data as ProductWithCategory)?.category_id) {
        const { data: related, error: relatedError } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(*),
            product_images (
              id,
              image_url,
              display_order,
              is_primary
            )
          `)
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

  const handleVariantChange = useCallback((variantId: string) => {
    if (!product) return

    setSelectedVariantId(variantId || null)
    setCurrentImageIndex(0)
    setImageLoading(true)
    setFadeIn(false)
    setAllImagesFailed(false)

    if (variantId) {
      supabase
        .from('product_variants')
        .select('*')
        .eq('id', variantId)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedVariant(data)
            setQuantity(1)

            getProductStock(product.id, variantId)
              .then((stock) => setVariantStock(stock))
              .catch((error) => {
                console.error('Error fetching variant stock:', error)
                setVariantStock(0)
              })
          }
        })
      return
    }

    setSelectedVariant(null)
    setVariantStock(null)
    setQuantity(1)
  }, [product])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: 'var(--org-primary-color, #6366f1)' }}
        />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container-custom py-8 text-center">
        <p className="text-gray-600 text-lg mb-4">Producto no encontrado</p>
        <Link to={slug ? `/${slug}/products` : '/products'}>
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
      <Link to={slug ? `/${slug}/products` : '/products'}>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a productos
        </Button>
      </Link>

      <div ref={productRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Imagen del producto */}
        <div>
          {(() => {
            const productWithImages = product as Product & { product_images?: ProductImage[] }
            
            // Get all available image URLs in priority order
            const imageUrls: string[] = []
            
            // 1. Variant image (if exists)
            if (selectedVariant?.image_url && isValidImageUrl(selectedVariant.image_url)) {
              imageUrls.push(selectedVariant.image_url)
            }
            
            // 2. Product images (sorted by is_primary and display_order)
            if (productWithImages.product_images && productWithImages.product_images.length > 0) {
              const sorted = [...productWithImages.product_images]
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
            
            // 3. Legacy image_url (if exists and valid)
            if (product.image_url && isValidImageUrl(product.image_url) && !imageUrls.includes(product.image_url)) {
              imageUrls.push(product.image_url)
            }
            
            // Get current image URL to try
            const currentImageUrl = imageUrls[currentImageIndex]
            const hasMultipleImages = imageUrls.length > 1
            
            const handlePreviousImage = () => {
              setFadeIn(false)
              setTimeout(() => {
                setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : imageUrls.length - 1))
                setImageLoading(true)
              }, 150)
            }
            
            const handleNextImage = () => {
              setFadeIn(false)
              setTimeout(() => {
                setCurrentImageIndex((prev) => (prev < imageUrls.length - 1 ? prev + 1 : 0))
                setImageLoading(true)
              }, 150)
            }
            
            const handleImageLoad = () => {
              setImageLoading(false)
              setFadeIn(true)
            }
            
            if (!currentImageUrl || allImagesFailed) {
              return (
                <img
                  src={DEFAULT_PRODUCT_PLACEHOLDER}
                  alt={capitalizeFirst(product.name)}
                  className="w-full h-96 object-cover rounded-lg"
                />
              )
            }
            
            return (
              <div className="relative">
                <div className="relative w-full overflow-hidden rounded-lg shadow-lg">
                  <div className="relative w-full" style={{ aspectRatio: '1 / 1', minHeight: '400px' }}>
                    <img
                      key={`${selectedVariantId ?? 'base'}-${currentImageIndex}`}
                      src={currentImageUrl}
                      alt={capitalizeFirst(product.name)}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        fadeIn ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={handleImageLoad}
                      onError={() => {
                        console.error('Error loading image:', currentImageUrl)
                        setImageLoading(false)
                        // Try next image if available
                        if (currentImageIndex < imageUrls.length - 1) {
                          setCurrentImageIndex(currentImageIndex + 1)
                        } else {
                          // All images failed, show placeholder
                          setAllImagesFailed(true)
                        }
                      }}
                    />
                    {imageLoading && (
                      <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                        <div className="text-gray-400">Cargando...</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Navigation buttons - only show if multiple images */}
                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={handlePreviousImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                        aria-label="Imagen anterior"
                      >
                        <ChevronLeft className="h-6 w-6 text-gray-800" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                        aria-label="Siguiente imagen"
                      >
                        <ChevronRight className="h-6 w-6 text-gray-800" />
                      </button>
                      
                      {/* Image counter */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                        {currentImageIndex + 1} / {imageUrls.length}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Thumbnail navigation - only show if multiple images */}
                {hasMultipleImages && imageUrls.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                    {imageUrls.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (index !== currentImageIndex) {
                            setFadeIn(false)
                            setTimeout(() => {
                              setCurrentImageIndex(index)
                              setImageLoading(true)
                            }, 150)
                          }
                        }}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                          index === currentImageIndex ? 'ring-2 scale-105' : 'border-gray-300 hover:border-gray-400 hover:scale-105'
                        }`}
                        style={
                          index === currentImageIndex
                            ? {
                                borderColor: 'var(--org-primary-color, #6366f1)',
                                boxShadow: '0 0 0 2px color-mix(in srgb, var(--org-primary-color, #6366f1) 30%, transparent)',
                              }
                            : undefined
                        }
                        aria-label={`Ver imagen ${index + 1}`}
                      >
                        <img
                          src={url}
                          alt={`${capitalizeFirst(product.name)} - Imagen ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Información del producto */}
        <div>
          <div className="mb-4">
            {product.category && (
              <span
                className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-2"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--org-primary-color, #6366f1) 15%, white)',
                  color: 'var(--org-primary-color, #6366f1)',
                }}
              >
                {product.category.name}
              </span>
            )}
            <h1
              className="text-3xl font-bold text-gray-900 mb-2"
              style={{ fontFamily: 'var(--org-font-heading, var(--org-font-family, Poppins))' }}
            >
              {capitalizeFirst(product.name)}
            </h1>
            <p
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--org-primary-color, #6366f1)' }}
            >
              {formatPrice(selectedVariant?.price ?? product.price, settings)}
            </p>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 leading-relaxed">
              {capitalizeFirst(product.description) || 'Sin descripción disponible'}
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
              onVariantChange={handleVariantChange}
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
                    disabled={quantity <= 1 || (hasActiveVariants && !selectedVariantId)}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentStock = selectedVariantId ? (variantStock ?? 0) : (productStock ?? 0)
                      setQuantity(Math.min(currentStock, quantity + 1))
                    }}
                    disabled={
                      (hasActiveVariants && !selectedVariantId) ||
                      quantity >= (selectedVariantId ? (variantStock ?? 0) : (productStock ?? 0))
                    }
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Stock disponible: <span className="font-semibold">
                    {hasActiveVariants && !selectedVariantId
                      ? 'Selecciona una variante'
                      : selectedVariantId
                      ? (variantStock !== null ? variantStock : 'Cargando...')
                      : (productStock !== null ? productStock : 'Cargando...')
                    } {selectedVariant?.unit || product.unit || 'unidad'}
                  </span>
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleAddToCart}
                disabled={
                  (hasActiveVariants && !selectedVariantId) ||
                  (selectedVariantId ? (variantStock ?? 0) : (productStock ?? 0)) === 0 ||
                  isAdding ||
                  (selectedVariantId ? variantStock === null : productStock === null)
                }
                isLoading={isAdding}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {hasActiveVariants && !selectedVariantId ? 'Selecciona una variante' : 'Agregar al carrito'}
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
              <ProductCard key={relatedProduct.id} product={relatedProduct} basePath={slug ? `/${slug}` : ''} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
