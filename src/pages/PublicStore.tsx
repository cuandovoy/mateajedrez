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
import { ArrowRight } from 'lucide-react'
import { HomePhoto, HomePhotoHero, HomePersonalization } from '@/components/features/HomeEditorial'

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
  const { data: storeProductsData, isLoading: loading } = useStoreProducts(organization.id)
  const products = storeProductsData?.products ?? []
  const stockByProduct = storeProductsData?.stockByProduct ?? {}
  const categories = allCategories.filter((cat: Category) => !cat.parent_id)

  const featuredProducts = useMemo(() => {
    const seenCategoryIds = new Set<string>()
    const result: ProductWithImages[] = []

    for (const product of products) {
      const hasStock = (stockByProduct[product.id] ?? 0) > 0
      if (!hasStock) continue

      if (product.category_id) {
        if (seenCategoryIds.has(product.category_id)) continue
        seenCategoryIds.add(product.category_id)
      }

      result.push(product)
    }

    return result
  }, [products, stockByProduct])

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
  const heroSubtitleText = (settings.store_hero_subtitle_text as string) || 'MATE, luego existo'
  const heroOverlayOpacity = typeof settings.store_hero_overlay_opacity === 'number'
    ? settings.store_hero_overlay_opacity
    : 25
  const heroTextColor    = (settings.store_hero_text_color as string) || '#ffffff'
  const heroTextPosition = (settings.store_hero_text_position as string) ?? 'center'
  const heroHeight       = (settings.store_hero_height as string) ?? 'md'

  // Menos padding en mobile, mucho más en desktop: las fotos de portada son
  // verticales, así que un hero angosto-y-alto (mobile) recorta poco, pero uno
  // ancho-y-bajo (desktop) las recortaba de más — ver .claude/TODO.md.
  const heroHeightClass = { sm: 'py-6 md:py-16', md: 'py-8 md:py-24', lg: 'py-12 md:py-40', xl: 'py-14 md:py-64' }[heroHeight] ?? 'py-8 md:py-24'
  const heroAlignClass  = { center: 'text-center items-center', left: 'text-left items-start', 'bottom-left': 'text-left items-start justify-end pb-12' }[heroTextPosition] ?? 'text-center items-center'

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
      <div className="bg-brand-bg">
        <Skeleton className="w-full h-64 md:h-96 rounded-none" />
        <div className="container-custom py-12">
          <Skeleton className="h-6 w-40 mx-auto mb-10" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonProductCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-brand-bg">
      {/* Hero Banner Section */}
      {hasCoverImages ? <section className="relative w-full mb-0">
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
                  style={{ backgroundColor: `rgba(43,36,24,${heroOverlayOpacity / 100})` }}
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 bg-brand-crema border-b border-brand-line" />
          )}

          <div className={`container-custom relative z-10 flex flex-col flex-1 ${heroAlignClass}`}>
            {heroShowTitle && (
              <h1
                className="font-heading font-light uppercase text-3xl sm:text-5xl lg:text-6xl tracking-[0.25em] sm:tracking-[0.35em] mb-4 break-words max-w-full"
                style={{
                  color: hasCoverImages ? heroTextColor : 'var(--org-primary-color, #705931)',
                  textShadow: hasCoverImages ? '0 1px 3px rgba(43,36,24,0.35)' : undefined,
                }}
              >
                {organization.name}
              </h1>
            )}

            {heroShowSubtitle && (
              <p
                className="font-heading font-light uppercase text-sm md:text-base tracking-[0.3em] mb-8 max-w-xl"
                style={{
                  color: hasCoverImages ? heroTextColor : '#6E634F',
                  textShadow: hasCoverImages ? '0 1px 2px rgba(43,36,24,0.35)' : undefined,
                }}
              >
                {heroSubtitleText}
              </p>
            )}

            {heroShowCta && (
              <Link to="/products">
                <Button size="lg" className="px-8 md:px-10">
                  Ver productos
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}

            {coverImages.length > 1 && (
              <div className={`mt-6 flex items-center gap-2 ${heroTextPosition === 'center' ? 'justify-center' : 'justify-start'}`}>
                {coverImages.map((_, index) => (
                  <button
                    key={`indicator-${index}`}
                    type="button"
                    onClick={() => setCurrentCoverIndex(index)}
                    aria-label={`Ir a la imagen ${index + 1}`}
                    className="h-1 rounded-full transition-all duration-300"
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
      </section> : <HomePhotoHero />}

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="container-custom">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pb-4 border-b border-brand-line">
              <div>
                <h2 className="brand-title text-2xl md:text-3xl">Categorías</h2>
              </div>
              <Link
                to="/products"
                className="flex shrink-0 items-center gap-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-cuero border-b border-transparent hover:border-brand-cuero transition-colors"
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
      {featuredProducts.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="container-custom">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pb-4 border-b border-brand-line">
              <div>
                <h2 className="brand-title text-2xl md:text-3xl">Productos destacados</h2>
              </div>
              {products.length > 10 && (
                <Link
                  to="/products"
                  className="flex shrink-0 items-center gap-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-cuero border-b border-transparent hover:border-brand-cuero transition-colors"
                >
                  Ver todos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
              {featuredProducts.slice(0, 10).map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
                >
                  <ProductCard product={product} stock={stockByProduct[product.id]} noAddToCart={false} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <HomePersonalization />

      {/* About Section */}
      <section
        id="nosotros"
        className="py-12 md:py-20 scroll-mt-20 bg-brand-cuero-oscuro"
      >
        <div className="container-custom grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div>
            <h2 className="font-heading font-light uppercase tracking-[0.14em] text-3xl md:text-4xl text-brand-crema mb-4">
              Conocé Mates Ajedrez
            </h2>
            <p
              className="leading-relaxed mb-6 text-brand-crema/85"
            >
              En Mates Ajedrez trabajamos cada mate a mano: cuero crudo, algarrobo y grabado
              láser. Cada pieza se personaliza y se prepara antes de llegar a tu casa.
            </p>
            <p className="leading-relaxed mb-7 text-brand-crema/85">
              Estamos en Paysandú. Acercate al local para ver los mates de cerca y elegir los detalles del tuyo.
            </p>
            <Link to="/visitanos" className="inline-flex items-center gap-3 min-h-12 px-6 border border-brand-crema text-brand-crema font-heading text-sm uppercase tracking-widest hover:bg-brand-crema hover:text-brand-cuero-oscuro transition-colors focus-ring">
              Cómo llegar al local
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="aspect-square overflow-hidden border border-brand-crema/20">
            <HomePhoto
              name="mate-con-identidad"
              alt="Mate personalizado sobre una base de madera, entre plantas y materiales naturales"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
