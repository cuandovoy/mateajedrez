import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from '@/components/features/ProductCard'
import { CategoryCard } from '@/components/features/CategoryCard'
import { Skeleton, SkeletonProductCard } from '@/components/ui/Skeleton'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useStoreProducts } from '@/hooks/usePublicProducts'
import type { Product, Category, ProductImage } from '@/types'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Check } from 'lucide-react'

const STORE_COVER_IMAGES_KEY = 'store_cover_image_urls'
const HERO_SLIDE_INTERVAL_MS = 7000

type ProductWithImages = Product & { product_images?: ProductImage[] }

function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string' || url.trim().length === 0) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getOrderedProductImageUrls(product: ProductWithImages): string[] {
  const urls: string[] = []

  if (product.product_images && product.product_images.length > 0) {
    const sorted = [...product.product_images]
      .filter((image) => isValidImageUrl(image.image_url))
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return a.display_order - b.display_order
      })

    sorted.forEach((image) => {
      if (image.image_url && !urls.includes(image.image_url)) {
        urls.push(image.image_url)
      }
    })
  }

  if (isValidImageUrl(product.image_url) && !urls.includes(product.image_url)) {
    urls.push(product.image_url)
  }

  return urls
}

export function PublicStore() {
  const { organization } = usePublicStore()
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0)

  const { data: allCategories = [] } = usePublicCategories(organization.id)
  const { data: products = [], isLoading: loading } = useStoreProducts(organization.id)
  const categories = allCategories.filter((cat: Category) => !cat.parent_id)

  const categoryFallbackImages = useMemo(() => {
    if (products.length === 0 || allCategories.length === 0) {
      return new Map<string, string[]>()
    }

    const parentByCategoryId = new Map<string, string | null>(
      allCategories.map((category) => [category.id, category.parent_id])
    )

    const resolveTopCategoryId = (categoryId: string): string => {
      let currentId = categoryId
      const visited = new Set<string>()

      while (true) {
        if (visited.has(currentId)) return currentId
        visited.add(currentId)

        const parentId = parentByCategoryId.get(currentId)
        if (!parentId) return currentId
        currentId = parentId
      }
    }

    const fallbackByCategory = new Map<string, string[]>()

    products.forEach((product) => {
      if (!product.category_id) return

      const topCategoryId = resolveTopCategoryId(product.category_id)
      const images = getOrderedProductImageUrls(product)
      if (images.length === 0) return

      const currentFallback = fallbackByCategory.get(topCategoryId) ?? []
      for (const imageUrl of images) {
        if (currentFallback.length >= 3) break
        if (!currentFallback.includes(imageUrl)) {
          currentFallback.push(imageUrl)
        }
      }

      if (currentFallback.length > 0) {
        fallbackByCategory.set(topCategoryId, currentFallback)
      }
    })

    return fallbackByCategory
  }, [allCategories, products])

  const settings = (organization.settings as Record<string, unknown>) ?? {}
  const settingsCoverImages = Array.isArray(settings[STORE_COVER_IMAGES_KEY])
    ? (settings[STORE_COVER_IMAGES_KEY] as unknown[]).filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    : []
  const coverImages = settingsCoverImages.length > 0
    ? settingsCoverImages
    : organization.cover_image_url
      ? [organization.cover_image_url]
      : []
  const hasCoverImages = coverImages.length > 0

  const heroShowTitle    = (settings.store_hero_show_title as boolean) !== false
  const heroShowSubtitle = (settings.store_hero_show_subtitle as boolean) !== false
  const heroShowCta      = (settings.store_hero_show_cta as boolean) !== false
  const heroSubtitleText = (settings.store_hero_subtitle_text as string) || 'Bienvenido a nuestra tienda'
  const heroOverlayOpacity = typeof settings.store_hero_overlay_opacity === 'number'
    ? settings.store_hero_overlay_opacity
    : 25
  const heroTextColor    = (settings.store_hero_text_color as string) || '#ffffff'
  const heroTextPosition = (settings.store_hero_text_position as string) ?? 'center'
  const heroHeight       = (settings.store_hero_height as string) ?? 'md'

  const heroHeightClass = { sm: 'py-10 md:py-14', md: 'py-16 md:py-24', lg: 'py-24 md:py-36', xl: 'py-36 md:py-56' }[heroHeight] ?? 'py-16 md:py-24'
  const heroAlignClass  = { center: 'text-center items-center', left: 'text-left items-start', 'bottom-left': 'text-left items-start justify-end pb-12' }[heroTextPosition] ?? 'text-center items-center'

  const aboutImageUrl = useMemo(() => {
    const withImage = products.find(
      (product) => getOrderedProductImageUrls(product as ProductWithImages).length > 0
    ) as ProductWithImages | undefined
    return withImage ? getOrderedProductImageUrls(withImage)[0] : null
  }, [products])

  useEffect(() => {
    if (!loading && window.location.hash === '#nosotros') {
      document.getElementById('nosotros')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

  useEffect(() => {
    setCurrentCoverIndex(0)
  }, [coverImages.join('|')])

  useEffect(() => {
    if (coverImages.length <= 1) return
    const interval = window.setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % coverImages.length)
    }, HERO_SLIDE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [coverImages.length])

  if (loading) {
    return (
      <div className="bg-white">
        <Skeleton className="w-full h-64 md:h-96 rounded-none" />
        <div className="container-custom py-12">
          <Skeleton className="h-8 w-40 mx-auto mb-10 rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonProductCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      {/* Hero Banner Section */}
      <section className="relative w-full mb-0">
        <div className={`relative w-full ${heroHeightClass} overflow-hidden flex flex-col`}>
          {hasCoverImages ? (
            <div className="absolute inset-0">
              {coverImages.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-[1800ms]"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    opacity: index === currentCoverIndex ? 1 : 0,
                  }}
                />
              ))}
              {heroOverlayOpacity > 0 && (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: `rgba(0,0,0,${heroOverlayOpacity / 100})` }}
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
          )}

          <div className={`container-custom relative z-10 flex flex-col flex-1 ${heroAlignClass}`}>
            {heroShowTitle && (
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
                style={{
                  color: hasCoverImages ? heroTextColor : `var(--org-primary-color, #46362B)`,
                  fontFamily: `var(--org-font-heading, var(--org-font-family, Cambria))`,
                  letterSpacing: '0.05em',
                  textShadow: hasCoverImages ? '0 1px 3px rgba(0,0,0,0.25)' : undefined,
                }}
              >
                {organization.name}
              </h1>
            )}

            {heroShowSubtitle && (
              <p
                className="text-lg md:text-xl mb-8 max-w-xl"
                style={{
                  color: hasCoverImages ? heroTextColor : 'rgb(75 85 99)',
                  textShadow: hasCoverImages ? '0 1px 2px rgba(0,0,0,0.2)' : undefined,
                }}
              >
                {heroSubtitleText}
              </p>
            )}

            {heroShowCta && (
              <Link to="/products">
                <Button
                  size="lg"
                  className="px-8 py-4 md:px-10 md:py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-full"
                  style={{
                    backgroundColor: `var(--org-primary-color, #46362B)`,
                    color: 'var(--org-primary-ink, white)',
                  }}
                >
                  Ver productos
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}

            {coverImages.length > 1 && (
              <div className={`mt-6 flex items-center gap-2 ${heroTextPosition === 'center' ? 'justify-center' : 'justify-start'}`}>
                {coverImages.map((_, index) => (
                  <span
                    key={`indicator-${index}`}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: heroTextColor,
                      opacity: index === currentCoverIndex ? 1 : 0.4,
                      width: index === currentCoverIndex ? '24px' : '6px',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="container-custom">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-xl md:text-2xl font-bold text-gray-900"
                style={{ fontFamily: `var(--org-font-heading, var(--org-font-family, Cambria))`, letterSpacing: '0.05em' }}
              >
                Categorías
              </h2>
              <Link
                to="/products"
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--org-primary-color, #46362B)' }}
              >
                Ver todo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  fallbackImages={categoryFallbackImages.get(category.id) ?? []}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products Section */}
      {products.length > 0 && (
        <section className={`py-10 md:py-14 ${categories.length > 0 ? 'border-t border-gray-100' : ''}`}>
          <div className="container-custom">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-xl md:text-2xl font-bold text-gray-900"
                style={{ fontFamily: `var(--org-font-heading, var(--org-font-family, Cambria))`, letterSpacing: '0.05em' }}
              >
                Productos destacados
              </h2>
              {products.length > 10 && (
                <Link
                  to="/products"
                  className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--org-primary-color, #46362B)' }}
                >
                  Ver todos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
              {products.slice(0, 10).map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
                >
                  <ProductCard product={product} noAddToCart={false} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section
        id="nosotros"
        className="py-16 md:py-24 scroll-mt-20"
        style={{ backgroundColor: 'var(--org-primary-color, #46362B)' }}
      >
        <div className="container-custom grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className={aboutImageUrl ? 'order-2 md:order-1' : 'md:col-span-2 max-w-2xl mx-auto text-center'}>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{
                color: 'var(--org-primary-ink, #EAE2D6)',
                fontFamily: `var(--org-font-heading, var(--org-font-family, Cambria))`,
                letterSpacing: '0.05em',
              }}
            >
              Nosotros
            </h2>
            <p
              className="text-xl md:text-2xl italic mb-6 leading-snug"
              style={{
                color: 'var(--org-primary-ink, #EAE2D6)',
                fontFamily: `var(--org-font-heading, var(--org-font-family, Cambria))`,
                letterSpacing: '0.05em',
              }}
            >
              &ldquo;Las piezas con historia merecen ser parte de nuevos momentos.&rdquo;
            </p>
            <p
              className="leading-relaxed mb-6"
              style={{ color: 'color-mix(in srgb, var(--org-primary-ink, #EAE2D6) 85%, transparent)' }}
            >
              En Ruemia armamos cada pieza a mano: bordado artesanal, cuero genuino y una
              terminación pensada para acompañarte mucho tiempo. Nada de producción en serie —
              cada mate, materas o accesorio pasa por su propio proceso, hasta el curado final
              antes de llegar a tu casa.
            </p>
            <ul
              className={`flex flex-wrap gap-x-6 gap-y-2 mb-8 text-sm ${aboutImageUrl ? '' : 'justify-center'}`}
              style={{ color: 'color-mix(in srgb, var(--org-primary-ink, #EAE2D6) 90%, transparent)' }}
            >
              {['Bordado artesanal', 'Cuero genuino', 'Con curado incluido'].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link to="/products">
              <Button
                variant="outline"
                className="px-6 py-3 rounded-full font-semibold"
                style={{
                  borderColor: 'var(--org-primary-ink, #EAE2D6)',
                  color: 'var(--org-primary-ink, #EAE2D6)',
                }}
              >
                Ver la colección
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {aboutImageUrl && (
            <div className="order-1 md:order-2">
              <img
                src={aboutImageUrl}
                alt="Pieza artesanal Ruemia — bordado a mano y cuero genuino"
                className="w-full aspect-[4/5] md:aspect-[4/3] object-cover rounded-2xl shadow-lg"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
