import { ProductCard } from '@/components/features/ProductCard'
import { VariantSelector } from '@/components/features/VariantSelector'
import { Button } from '@/components/ui/Button'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useProductVariants } from '@/hooks/useProductVariants'
import { useStoreProduct } from '@/hooks/usePublicProducts'
import { capitalizeFirst, formatPrice, hasActiveDiscount, getEffectivePrice, normalizeLineBreaks } from '@/lib/utils'
import { getProductStock } from '@/lib/stock'
import { absoluteUrl } from '@/lib/siteUrl'
import { buildProductJsonLd, buildBreadcrumbJsonLd } from '@/lib/jsonLd'
import { useCartStore } from '@/store/cartStore'
import { useToastStore } from '@/store/toastStore'
import type { Product, ProductImage } from '@/types'
import { ArrowLeft, ShoppingCart, ChevronLeft, ChevronRight, MessageCircle, Share2, X, ZoomIn } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams } from 'react-router-dom'

const DEFAULT_PRODUCT_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="%23f3f4f6"/><g fill="%239ca3af"><rect x="240" y="260" width="320" height="220" rx="24"/><circle cx="320" cy="330" r="28"/><path d="M270 450l95-95 62 62 48-48 55 81z"/></g><text x="50%25" y="560" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" fill="%236b7280">Sin imagen</text></svg>'

// Fallbacks del sitio — deben coincidir con los tags estáticos de index.html
const DEFAULT_META_DESCRIPTION =
  'Mates artesanales en cuero crudo y algarrobo, grabados y personalizados en Paysandú, Uruguay. Tu mate, pero con tu esencia.'
const DEFAULT_OG_IMAGE = '/og-image.png'
const META_DESCRIPTION_MAX_LENGTH = 155

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

// Imagen principal del producto para el meta tag og:image — misma prioridad
// (is_primary > display_order) que la galería, sin depender del estado de UI
function getPrimaryImageUrl(product: Product & { product_images?: ProductImage[] }): string | null {
  const images = product.product_images ?? []
  const validImages = images.filter((img) => isValidImageUrl(img.image_url))
  const primary = validImages.find((img) => img.is_primary) ?? validImages[0]
  if (primary?.image_url) return primary.image_url
  if (isValidImageUrl(product.image_url)) return product.image_url as string
  return null
}

// Todas las imágenes válidas del producto, mismo orden que la galería
// (is_primary > display_order) — usado por el JSON-LD de Product, que acepta
// un array completo de imágenes (no solo la principal).
function getAllImageUrls(product: Product & { product_images?: ProductImage[] }): string[] {
  const images = product.product_images ?? []
  const sorted = [...images]
    .filter((img) => isValidImageUrl(img.image_url))
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return a.display_order - b.display_order
    })
  const urls = sorted.map((img) => img.image_url as string)
  if (isValidImageUrl(product.image_url) && !urls.includes(product.image_url as string)) {
    urls.push(product.image_url as string)
  }
  return urls
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const settings = useOrgSettings()
  const { organization } = usePublicStore()
  const { addToCart } = useCartStore()
  const { show } = useToastStore()
  const { data: productData, isLoading: loading } = useStoreProduct(organization?.id, id)
  const product = productData?.product ?? null
  const relatedProducts = productData?.relatedProducts ?? []
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<{ image_url?: string | null; price?: number | null; stock?: number; unit?: string | null } | null>(null)

  // useProductVariants comparte caché con VariantSelector — un solo request de red
  const { data: variants = [] } = useProductVariants(organization?.id, id)
  const hasActiveVariants = variants.length > 0
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoading, setImageLoading] = useState(true)
  const [fadeIn, setFadeIn] = useState(false)

  // Cuando el browser tiene la imagen cacheada, onLoad dispara antes de que React
  // adjunte el handler. Este callback ref la detecta verificando img.complete.
  const handleImgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setImageLoading(false)
      setFadeIn(true)
    }
  }, [])
  const [allImagesFailed, setAllImagesFailed] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [productStock, setProductStock] = useState<number | null>(null)
  // Poblado por VariantSelector (onVariantStocksChange) — evita que ProductDetail
  // pida por su cuenta el stock de la variante seleccionada con una segunda
  // llamada a getProductStock descoordinada de la que ya hace VariantSelector.
  const [variantStockMap, setVariantStockMap] = useState<Record<string, number>>({})
  const [allVariantsUnavailable, setAllVariantsUnavailable] = useState(false)
  const productRef = useRef<HTMLDivElement>(null)
  const touchStartXRef = useRef<number | null>(null)


  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [id])

  // Resetea el estado de la galería cuando cambia el producto cargado
  useEffect(() => {
    setCurrentImageIndex(0)
    setImageLoading(true)
    setFadeIn(false)
    setAllImagesFailed(false)
    setAllVariantsUnavailable(false)
    setIsLightboxOpen(false)
  }, [product?.id])

  // Cerrar el lightbox con Escape — mismo patrón que el dropdown de categorías
  // del header (ver CategoryMenu en PublicStoreHeader.tsx).
  useEffect(() => {
    if (!isLightboxOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isLightboxOpen])

  const handleVariantAvailabilityChange = useCallback((hasAvailableVariant: boolean) => {
    setAllVariantsUnavailable(!hasAvailableVariant)
  }, [])

  const handleVariantStocksChange = useCallback((stocks: Record<string, number>) => {
    setVariantStockMap(stocks)
  }, [])

  useEffect(() => {
    if (!product) {
      setProductStock(null)
      return
    }
    let cancelled = false
    getProductStock(product.id, null, null, product.organization_id || null)
      .then((stock) => { if (!cancelled) setProductStock(stock) })
      .catch(() => { if (!cancelled) setProductStock(0) })
    return () => { cancelled = true }
  }, [product?.id, product?.organization_id])

  const handleAddToCart = async () => {
    if (!product) return

    setIsAdding(true)
    try {
      await addToCart(product.id, quantity, selectedVariantId || undefined)
    } catch (error) {
      console.error('Error adding to cart:', error)
      show('No se pudo agregar el producto al carrito', 'error')
    } finally {
      setIsAdding(false)
    }
  }

  const handleShare = async () => {
    if (!product) return
    const shareUrl = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url: shareUrl })
      } catch {
        // Usuario canceló el share nativo — no es un error a mostrar
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      show('Link copiado', 'success')
    } catch {
      show('No se pudo copiar el link', 'error')
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
      const variant = variants.find((v) => v.id === variantId)
      if (variant) {
        setSelectedVariant(variant)
        setQuantity(1)
      }
      return
    }

    setSelectedVariant(null)
    setQuantity(1)
  }, [product, variants])

  if (loading) {
    return (
      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="aspect-square bg-brand-crema rounded-lg animate-pulse" />
          <div className="space-y-4">
            <div className="h-5 w-24 bg-brand-crema rounded-full animate-pulse" />
            <div className="h-9 w-3/4 bg-brand-crema rounded-lg animate-pulse" />
            <div className="h-7 w-32 bg-brand-crema rounded-lg animate-pulse" />
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full bg-brand-crema rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-brand-crema rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-brand-crema rounded animate-pulse" />
            </div>
            <div className="h-12 w-full bg-brand-crema rounded-lg animate-pulse mt-6" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container-custom py-8 text-center">
        <Helmet>
          <meta name="robots" content="noindex" />
        </Helmet>
        <p className="text-brand-muted text-lg mb-4">Producto no encontrado</p>
        <Link to="/products">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a productos
          </Button>
        </Link>
      </div>
    )
  }

  const variantStock = selectedVariantId
    ? (selectedVariantId in variantStockMap ? variantStockMap[selectedVariantId] : null)
    : null
  const currentStock = selectedVariantId ? variantStock : productStock
  const isOutOfStock = hasActiveVariants && !selectedVariantId
    ? allVariantsUnavailable
    : currentStock !== null && currentStock <= 0
  const whatsappHref = settings.store_whatsapp_number
    ? `https://wa.me/${settings.store_whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hola! Quiero consultar sobre la disponibilidad de "${product.name}" (${window.location.href})`
      )}`
    : null

  const singleLineDescription = normalizeLineBreaks(product.description).replace(/\s*\n+\s*/g, ' ').trim()
  const metaDescription = singleLineDescription
    ? singleLineDescription.length > META_DESCRIPTION_MAX_LENGTH
      ? `${singleLineDescription.slice(0, META_DESCRIPTION_MAX_LENGTH).trimEnd()}...`
      : singleLineDescription
    : DEFAULT_META_DESCRIPTION
  const metaTitle = `${capitalizeFirst(product.name)} | Mates Ajedrez`
  // getPrimaryImageUrl ya valida http(s) (isValidImageUrl) y devuelve siempre
  // una URL absoluta real de Supabase Storage — solo el fallback necesita
  // pasar por absoluteUrl(), porque DEFAULT_OG_IMAGE es una ruta relativa.
  const ogImageUrl = getPrimaryImageUrl(product as Product & { product_images?: ProductImage[] }) ?? absoluteUrl(DEFAULT_OG_IMAGE)
  const productUrl = absoluteUrl(`/product/${product.id}`)
  const displayPrice = selectedVariant ? (selectedVariant.price ?? getEffectivePrice(product)) : getEffectivePrice(product)

  const productJsonLd = buildProductJsonLd({
    name: capitalizeFirst(product.name),
    description: singleLineDescription || null,
    images: getAllImageUrls(product as Product & { product_images?: ProductImage[] }),
    sku: product.sku,
    url: productUrl,
    price: displayPrice,
    // useOrgSettings() ya resuelve un string real en runtime (ver
    // DEFAULT_SETTINGS en useOrgSettings.ts) — el `?? 'ARS'` es solo para
    // satisfacer el tipo `OrganizationSettings.currency` (string | null),
    // más laxo que la garantía real del hook.
    priceCurrency: settings.currency ?? 'ARS',
    availability: isOutOfStock ? 'OutOfStock' : 'InStock',
  })

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Inicio', url: absoluteUrl('/') },
    ...(product.category
      ? [{ name: product.category.name, url: absoluteUrl(`/categories/${product.category.slug}`) }]
      : []),
    { name: capitalizeFirst(product.name), url: productUrl },
  ])

  return (
    <div className="container-custom py-8">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={productUrl} />
        <link rel="canonical" href={productUrl} />
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-brand-muted">
        <Link to="/" className="hover:text-brand-muted transition-colors">Inicio</Link>
        {product.category && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/categories/${product.category.slug}`} className="hover:text-brand-muted transition-colors">
              {product.category.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-brand-muted font-medium truncate max-w-[200px] sm:max-w-none">
          {capitalizeFirst(product.name)}
        </span>
      </nav>

      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>

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

            const SWIPE_THRESHOLD_PX = 40
            const handleTouchStart = (e: React.TouchEvent) => {
              touchStartXRef.current = e.touches[0].clientX
            }
            const handleTouchEnd = (e: React.TouchEvent) => {
              const startX = touchStartXRef.current
              touchStartXRef.current = null
              if (startX === null || !hasMultipleImages) return
              const deltaX = e.changedTouches[0].clientX - startX
              if (deltaX > SWIPE_THRESHOLD_PX) handlePreviousImage()
              else if (deltaX < -SWIPE_THRESHOLD_PX) handleNextImage()
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
                <div
                  className="relative w-full overflow-hidden rounded-md border border-brand-line"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="relative w-full" style={{ aspectRatio: '1 / 1', minHeight: '400px' }}>
                    <img
                      key={`${selectedVariantId ?? 'base'}-${currentImageIndex}`}
                      ref={handleImgRef}
                      src={currentImageUrl}
                      alt={capitalizeFirst(product.name)}
                      onClick={() => setIsLightboxOpen(true)}
                      className={`w-full h-full object-cover cursor-zoom-in transition-opacity duration-300 ${
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
                      <div className="absolute inset-0 brand-shimmer flex items-center justify-center">
                        <div className="text-brand-muted">Cargando...</div>
                      </div>
                    )}
                    {!imageLoading && (
                      <div className="absolute top-3 right-3 bg-brand-tinta/60 text-white rounded-full p-1.5 pointer-events-none">
                        <ZoomIn className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  {/* Navigation buttons - only show if multiple images */}
                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={handlePreviousImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 transition-all"
                        aria-label="Imagen anterior"
                      >
                        <ChevronLeft className="h-6 w-6 text-brand-tinta" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 transition-all"
                        aria-label="Siguiente imagen"
                      >
                        <ChevronRight className="h-6 w-6 text-brand-tinta" />
                      </button>
                      
                      {/* Image counter */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-tinta/60 text-white px-3 py-1 rounded-full text-sm">
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
                        className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border transition-colors duration-200 ${
                          index === currentImageIndex ? 'border-brand-cuero ring-1 ring-brand-cuero' : 'border-brand-line hover:border-brand-algarrobo'
                        }`}
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

                {/* Lightbox — reusa handlePreviousImage/handleNextImage de la galería */}
                {isLightboxOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-brand-tinta/60 p-4"
                    onClick={() => setIsLightboxOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(false)}
                      className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                      aria-label="Cerrar"
                    >
                      <X className="h-7 w-7" />
                    </button>

                    <div
                      className="relative flex items-center justify-center max-w-4xl w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={currentImageUrl}
                        alt={capitalizeFirst(product.name)}
                        className="max-h-[85vh] w-auto max-w-full object-contain rounded-lg"
                      />

                      {hasMultipleImages && (
                        <>
                          <button
                            type="button"
                            onClick={handlePreviousImage}
                            className="absolute left-2 sm:-left-14 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            aria-label="Imagen anterior"
                          >
                            <ChevronLeft className="h-6 w-6 text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNextImage}
                            className="absolute right-2 sm:-right-14 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                            aria-label="Siguiente imagen"
                          >
                            <ChevronRight className="h-6 w-6 text-white" />
                          </button>
                          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/80 text-sm">
                            {currentImageIndex + 1} / {imageUrls.length}
                          </div>
                        </>
                      )}
                    </div>
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
              <Link
                to={`/categories/${product.category.slug}`}
                className="brand-eyebrow inline-block mb-3 border-b border-transparent hover:border-brand-cuero transition-colors"
              >
                {product.category.name}
              </Link>
            )}
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1
                className="brand-title text-2xl md:text-3xl"
              >
                {capitalizeFirst(product.name)}
              </h1>
              <button
                type="button"
                onClick={handleShare}
                className="shrink-0 h-10 w-10 rounded-full border border-brand-line text-brand-cuero flex items-center justify-center hover:border-brand-cuero transition-colors"
                aria-label="Compartir producto"
                title="Compartir"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4">
              {!selectedVariant && hasActiveDiscount(product) && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center rounded-full bg-brand-cuero px-3 py-1 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-brand-crema">
                    -{product.discount_percentage}% OFF
                  </span>
                  <span className="text-lg text-brand-muted line-through">
                    {formatPrice(product.price, settings)}
                  </span>
                </div>
              )}
              <p className="font-heading text-3xl font-semibold tabular-nums text-brand-cuero">
                {formatPrice(displayPrice, settings)}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-brand-muted leading-relaxed whitespace-pre-line">
              {capitalizeFirst(normalizeLineBreaks(product.description)) || 'Sin descripción disponible'}
            </p>
          </div>

          <div className="mb-6 space-y-4">
            <div>
              <span className="brand-eyebrow !text-brand-muted">SKU </span>
              <span className="text-sm text-brand-muted tabular-nums">{product.sku}</span>
            </div>
          </div>

          {/* Variant Selector - Solo permite seleccionar una variante a la vez */}
          <div className="mb-6">
            <VariantSelector
              product={product}
              selectedVariantId={selectedVariantId}
              onVariantChange={handleVariantChange}
              onAvailabilityChange={handleVariantAvailabilityChange}
              onVariantStocksChange={handleVariantStocksChange}
            />
          </div>

          <div className="mb-6 pt-6 border-t border-brand-line">
            {!isOutOfStock && (
              <div className="flex items-center gap-6 mb-4">
                <span className="brand-eyebrow !text-brand-muted">Cantidad</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1 || (hasActiveVariants && !selectedVariantId)}
                    className="h-9 w-9 rounded-full border border-brand-line flex items-center justify-center text-brand-tinta hover:border-brand-cuero disabled:opacity-40 disabled:pointer-events-none transition-colors text-lg font-light"
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-semibold text-lg">{quantity}</span>
                  <button
                    onClick={() => {
                      const maxStock = selectedVariantId ? (variantStock ?? 0) : (productStock ?? 0)
                      setQuantity(Math.min(maxStock, quantity + 1))
                    }}
                    disabled={
                      (hasActiveVariants && !selectedVariantId) ||
                      quantity >= (selectedVariantId ? (variantStock ?? 0) : (productStock ?? 0))
                    }
                    className="h-9 w-9 rounded-full border border-brand-line flex items-center justify-center text-brand-tinta hover:border-brand-cuero disabled:opacity-40 disabled:pointer-events-none transition-colors text-lg font-light"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm text-brand-muted ml-auto">
                  {hasActiveVariants && !selectedVariantId
                    ? 'Seleccioná una variante'
                    : `${selectedVariantId
                        ? (variantStock !== null ? variantStock : '…')
                        : (productStock !== null ? productStock : '…')
                      } ${selectedVariant?.unit || product.unit || 'unidades'} disponibles`
                  }
                </span>
              </div>
            )}
            {isOutOfStock && (
              <p className="text-sm text-brand-muted mb-4">Este producto no tiene stock disponible.</p>
            )}
            {isOutOfStock && whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-md bg-brand-cuero font-heading text-sm font-semibold uppercase tracking-[0.14em] text-brand-crema transition-colors hover:bg-brand-cuero-oscuro focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cuero focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-5 w-5" />
                Consultar disponibilidad
              </a>
            ) : (
              <Button
                className="w-full h-12"
                onClick={handleAddToCart}
                disabled={
                  (hasActiveVariants && !selectedVariantId) ||
                  (selectedVariantId ? (variantStock ?? 0) : (productStock ?? 0)) === 0 ||
                  isAdding ||
                  (selectedVariantId ? variantStock === null : productStock === null)
                }
                isLoading={isAdding}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {hasActiveVariants && !selectedVariantId ? 'Seleccioná una variante' : 'Agregar al carrito'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Productos relacionados */}
      {relatedProducts.length > 0 && (
        <div>
          <div className="mb-8 pb-4 border-b border-brand-line">
            <p className="brand-eyebrow mb-2">Seguí mirando</p>
            <h2 className="brand-title text-xl md:text-2xl">Productos relacionados</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
