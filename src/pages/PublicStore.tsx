import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ProductCard } from '@/components/features/ProductCard'
import { CategoryCard } from '@/components/features/CategoryCard'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import type { Product, Category, ProductImage } from '@/types'
import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'

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
  const { organization, slug } = usePublicStore()
  const [products, setProducts] = useState<ProductWithImages[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    const isMounted = { current: true }

    const fetchData = async () => {
      try {
        if (!organization.id) {
          setLoading(false)
          return
        }

        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            *,
            product_images (
              id,
              image_url,
              display_order,
              is_primary,
              product_id,
              created_at,
              updated_at
            )
          `)
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (productsError) throw productsError

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .eq('organization_id', organization.id)
          .order('name')

        if (categoriesError) throw categoriesError

        if (isMounted.current) {
          setProducts(productsData || [])
          const availableCategories = categoriesData || []
          setAllCategories(availableCategories)
          setCategories(availableCategories.filter((category) => !category.parent_id))
        }
      } catch (error) {
        if ((error instanceof Error && error.name !== 'AbortError') || !(error instanceof Error)) {
          console.error('Error fetching store data:', error)
        }
      } finally {
        if (isMounted.current) setLoading(false)
      }
    }

    fetchData()
    return () => {
      isMounted.current = false
    }
  }, [organization.id])

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
      <div className="flex items-center justify-center min-h-screen">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: `var(--org-primary-color, #6366f1)` }}
        ></div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      {/* Hero Banner Section */}
      <section className="relative w-full mb-0">
        <div className="relative w-full py-16 md:py-24 overflow-hidden">
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
              <div className="absolute inset-0 bg-black/25" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
          )}

          <div className="container-custom text-center relative z-10">
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
              style={{
                color: hasCoverImages ? 'white' : `var(--org-primary-color, #6366f1)`,
                fontFamily: `var(--org-font-heading, var(--org-font-family, Poppins))`,
                textShadow: hasCoverImages ? '0 1px 2px rgba(0,0,0,0.5)' : undefined,
              }}
            >
              {organization.name}
            </h1>
            <p
              className="text-lg md:text-xl mb-8"
              style={{
                color: hasCoverImages ? 'rgba(255,255,255,0.95)' : 'rgb(75 85 99)',
                textShadow: hasCoverImages ? '0 1px 2px rgba(0,0,0,0.4)' : undefined,
              }}
            >
              Bienvenido a nuestra tienda
            </p>
            <Link to={`/${slug}/products`}>
              <Button
                size="lg"
                className="px-8 py-4 md:px-12 md:py-5 text-base md:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: `var(--org-primary-color, #6366f1)`,
                  color: 'white',
                }}
              >
                Ver Productos
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            {coverImages.length > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {coverImages.map((_, index) => (
                  <span
                    key={`indicator-${index}`}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      index === currentCoverIndex ? 'bg-white' : 'bg-white/45'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-12 md:py-16 bg-gray-50 border-b border-gray-200">
          <div className="container-custom">
            <div className="text-center mb-10 md:mb-12">
              <h2 
                className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: `var(--org-font-heading, var(--org-font-family, Poppins))` }}
              >
                Nuestras Categorías
              </h2>
              <p className="text-gray-600 text-lg md:text-xl">
                Explora nuestras colecciones
              </p>
            </div>
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
              {categories.length <= 2 ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-8 lg:gap-12">
                  {categories.map((category) => (
                    <div key={category.id} className="w-full sm:w-[400px] md:w-[450px] lg:w-[500px]">
                      <CategoryCard
                        category={category}
                        basePath={`/${slug}`}
                        fallbackImages={categoryFallbackImages.get(category.id) ?? []}
                      />
                    </div>
                  ))}
                </div>
              ) : categories.length <= 4 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
                  {categories.map((category) => (
                    <div key={category.id} className="w-full">
                      <CategoryCard
                        category={category}
                        basePath={`/${slug}`}
                        fallbackImages={categoryFallbackImages.get(category.id) ?? []}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {categories.map((category) => (
                    <div key={category.id} className="w-full">
                      <CategoryCard
                        category={category}
                        basePath={`/${slug}`}
                        fallbackImages={categoryFallbackImages.get(category.id) ?? []}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products Section */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container-custom">
          <div className="text-center mb-10 md:mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"
              style={{ fontFamily: `var(--org-font-heading, var(--org-font-family, Poppins))` }}
            >
              Productos Destacados
            </h2>
            <p className="text-gray-600 text-lg md:text-xl">
              Lo más nuevo de nuestra colección
            </p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 text-lg">
                No hay productos disponibles
              </p>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {products.slice(0, 8).map((product) => (
                  <div key={product.id} className="w-full">
                    <ProductCard product={product} noAddToCart={false} basePath={`/${slug}`} />
                  </div>
                ))}
              </div>
              {products.length > 8 && (
                <div className="text-center mt-10 md:mt-12">
                  <Link to={`/${slug}/products`}>
                    <Button 
                      size="lg" 
                      className="px-8 py-3 text-base font-semibold flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: `var(--org-primary-color, #6366f1)`,
                        color: 'white'
                      }}
                    >
                      Ver todos los productos
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
